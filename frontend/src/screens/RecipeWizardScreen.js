import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { MobileFrame } from "@/components/common/MobileFrame";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { FullScreenLoader } from "@/components/common/FullScreenLoader";
import { WizardHeader } from "@/components/recipes/wizard/WizardHeader";
import { Step1Title } from "@/components/recipes/wizard/Step1Title";
import { Step2Difficulty } from "@/components/recipes/wizard/Step2Difficulty";
import { Step3Servings } from "@/components/recipes/wizard/Step3Servings";
import { Step4Ingredients } from "@/components/recipes/wizard/Step4Ingredients";
import { Step5Steps } from "@/components/recipes/wizard/Step5Steps";
import { computeNutritionPerServing } from "@/lib/recipeNutrition";
import { track } from "@/lib/analytics";
import { ComingSoon } from "@/components/common/ComingSoon";

const TOTAL_STEPS = 5;

/**
 * RecipeWizardScreen (REC-002) — orchestrates the 5-step persistent draft.
 *
 * Routes:
 *   - /my-recipes/new          → new recipe mode
 *   - /my-recipes/edit/:id     → resume mode
 */
export default function RecipeWizardScreen({ mode = "new" }) {
  const { id: routeRecipeId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [bootstrapping, setBootstrapping] = useState(true);
  const [unsupported, setUnsupported] = useState(false);

  const [recipeId, setRecipeId] = useState(null);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Step 1
  const [title, setTitle] = useState("");
  // Step 2
  const [difficulty, setDifficulty] = useState("medium");
  const [prepTime, setPrepTime] = useState("30");
  // Step 3
  const [servings, setServings] = useState(4);
  // Step 4
  const [ingredients, setIngredients] = useState([]);
  // Step 5
  const [stepsText, setStepsText] = useState([""]);

  // Close confirmation
  const [confirmClose, setConfirmClose] = useState(false);

  // Duplicate-title warning dialog (D-030).
  // Shape: { open, step, displayTitle, proceed }
  const [duplicateDialog, setDuplicateDialog] = useState(null);

  // -------- Bootstrap --------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (mode === "new") {
        track("recipe_wizard_started");
        setBootstrapping(false);
        return;
      }
      // resume mode
      const { data: rec, error } = await supabase
        .from("recipes")
        .select(
          "id, user_id, title, difficulty, prep_time_minutes, servings, status, is_draft, draft_step"
        )
        .eq("id", routeRecipeId)
        .maybeSingle();
      if (cancelled) return;
      if (error || !rec || rec.user_id !== user?.id) {
        navigate("/my-recipes", { replace: true });
        return;
      }
      if (!rec.is_draft) {
        // Editing already-completed recipes is out of scope.
        setUnsupported(true);
        setBootstrapping(false);
        return;
      }
      setRecipeId(rec.id);
      setTitle(rec.title || "");
      setDifficulty(rec.difficulty || "medium");
      setPrepTime(
        rec.prep_time_minutes != null ? String(rec.prep_time_minutes) : "30"
      );
      setServings(rec.servings ?? 4);

      // Load ingredients (with their resolved unit + base factor)
      const ingsRes = await supabase
        .from("recipe_ingredients")
        .select(
          "id, ingredient_id, user_ingredient_id, quantity, unit_id, is_key, sort_order, ingredients(name, base_unit, category_id, ingredient_categories(name)), user_ingredients(name, base_unit), units(name, symbol)"
        )
        .eq("recipe_id", rec.id)
        .order("sort_order", { ascending: true });
      const ingRows = (ingsRes.data || []).map((r) => ({
        id: r.id,
        ingredient_id: r.ingredient_id ?? undefined,
        user_ingredient_id: r.user_ingredient_id ?? undefined,
        ingredient_name:
          r.ingredients?.name ?? r.user_ingredients?.name ?? "—",
        category_name: r.ingredients?.ingredient_categories?.name ?? undefined,
        ingredient_base_unit:
          r.ingredients?.base_unit ?? r.user_ingredients?.base_unit ?? "g",
        quantity: Number(r.quantity),
        unit_id: r.unit_id,
        unit_symbol: r.units?.symbol ?? "",
        unit_to_base_factor: 1, // resolved below
        is_key: !!r.is_key,
      }));
      // Resolve to_base_factor for each ingredient row
      for (const row of ingRows) {
        if (row.ingredient_id) {
          const { data: conv } = await supabase
            .from("unit_conversions")
            .select("to_base_factor, units!inner(name)")
            .eq("ingredient_id", row.ingredient_id)
            .eq("unit_id", row.unit_id)
            .maybeSingle();
          if (conv) row.unit_to_base_factor = Number(conv.to_base_factor);
        }
      }
      setIngredients(ingRows);

      // Load steps
      const stepsRes = await supabase
        .from("recipe_steps")
        .select("step_number, instruction")
        .eq("recipe_id", rec.id)
        .order("step_number", { ascending: true });
      const stepsList = (stepsRes.data || []).map((s) => s.instruction);
      setStepsText(stepsList.length > 0 ? stepsList : [""]);

      const fromStep = Math.min(Math.max(rec.draft_step ?? 1, 1), TOTAL_STEPS);
      track("recipe_wizard_resumed", { from_step: fromStep });
      setStep(fromStep);
      setBootstrapping(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, routeRecipeId]);

  // -------- Step 1 → INSERT or UPDATE title --------
  /**
   * Check whether the user already has a NON-DRAFT recipe whose title matches
   * the given input after trim+lowercase comparison (accent-sensitive).
   * Excludes the current recipe (so resuming a draft doesn't match itself).
   */
  const checkDuplicateTitle = useCallback(
    async (trimmed) => {
      if (!user || !trimmed) return false;
      let q = supabase
        .from("recipes")
        .select("id, title")
        .eq("user_id", user.id)
        .eq("is_draft", false);
      if (recipeId) q = q.neq("id", recipeId);
      const { data } = await q;
      const target = trimmed.toLowerCase();
      return (data || []).some(
        (r) => (r.title || "").trim().toLowerCase() === target
      );
    },
    [user, recipeId]
  );

  const persistStep1 = async (trimmed) => {
    setBusy(true);
    try {
      if (recipeId == null) {
        const { data, error } = await supabase
          .from("recipes")
          .insert({
            user_id: user.id,
            title: trimmed,
            difficulty: "medium",
            servings: 4,
            status: "private",
            is_draft: true,
            draft_step: 2,
          })
          .select("id")
          .single();
        if (error) throw error;
        setRecipeId(data.id);
      } else {
        const { error } = await supabase
          .from("recipes")
          .update({ title: trimmed, draft_step: 2 })
          .eq("id", recipeId);
        if (error) throw error;
      }
      track("recipe_wizard_step_completed", { step: 1 });
      setStep(2);
    } catch (e) {
      setErrorMsg(
        "No se pudo guardar el título. Comprueba tu conexión e inténtalo de nuevo."
      );
    } finally {
      setBusy(false);
    }
  };

  const handleStep1Next = async () => {
    setErrorMsg("");
    const trimmed = (title || "").trim();
    if (!trimmed) return;
    const duplicate = await checkDuplicateTitle(trimmed);
    if (duplicate) {
      track("recipe_duplicate_title_warning_shown", { step: 1 });
      setDuplicateDialog({
        open: true,
        step: 1,
        displayTitle: title,
        proceed: () => persistStep1(trimmed),
      });
      return;
    }
    await persistStep1(trimmed);
  };

  // -------- Step 2 --------
  const handleStep2Next = async () => {
    setErrorMsg("");
    const time = parseInt(prepTime, 10);
    if (!Number.isFinite(time) || time <= 0 || !difficulty) return;
    setBusy(true);
    const { error } = await supabase
      .from("recipes")
      .update({ difficulty, prep_time_minutes: time, draft_step: 3 })
      .eq("id", recipeId);
    setBusy(false);
    if (error) {
      setErrorMsg(
        "No se pudo guardar. Comprueba tu conexión e inténtalo de nuevo."
      );
      return;
    }
    track("recipe_wizard_step_completed", { step: 2 });
    setStep(3);
  };

  // -------- Step 3 --------
  const handleStep3Next = async () => {
    setErrorMsg("");
    const v = Number(servings);
    if (!Number.isFinite(v) || v < 1) return;
    setBusy(true);
    const { error } = await supabase
      .from("recipes")
      .update({ servings: v, draft_step: 4 })
      .eq("id", recipeId);
    setBusy(false);
    if (error) {
      setErrorMsg(
        "No se pudo guardar. Comprueba tu conexión e inténtalo de nuevo."
      );
      return;
    }
    track("recipe_wizard_step_completed", { step: 3 });
    setStep(4);
  };

  // -------- Step 4 helpers --------
  const refreshHasPending = useCallback(
    async (list) => {
      const hasPending = list.some((x) => !!x.user_ingredient_id);
      await supabase
        .from("recipes")
        .update({ has_pending_ingredients: hasPending })
        .eq("id", recipeId);
    },
    [recipeId]
  );

  const handleAddIngredient = async (payload) => {
    setErrorMsg("");
    const sortOrder = ingredients.length;
    const insertBody = {
      recipe_id: recipeId,
      ingredient_id: payload.ingredient_id ?? null,
      user_ingredient_id: payload.user_ingredient_id ?? null,
      quantity: payload.quantity,
      unit_id: payload.unit_id,
      is_key: !!payload.is_key,
      sort_order: sortOrder,
    };
    const { data, error } = await supabase
      .from("recipe_ingredients")
      .insert(insertBody)
      .select("id")
      .single();
    if (error || !data) {
      setErrorMsg(
        "No se pudo añadir el ingrediente. Comprueba tu conexión e inténtalo de nuevo."
      );
      return;
    }
    const newRow = {
      id: data.id,
      ingredient_id: payload.ingredient_id,
      user_ingredient_id: payload.user_ingredient_id,
      ingredient_name: payload.ingredient_name,
      category_name: payload.category_name,
      ingredient_base_unit: payload.ingredient_base_unit,
      quantity: payload.quantity,
      unit_id: payload.unit_id,
      unit_symbol: payload.unit_symbol,
      unit_to_base_factor: payload.unit_to_base_factor,
      is_key: !!payload.is_key,
    };
    const next = [...ingredients, newRow];
    setIngredients(next);
    await refreshHasPending(next);
  };

  const handleToggleKey = async (row, next) => {
    setErrorMsg("");
    if (!row.id) return;
    const optimistic = ingredients.map((r) =>
      r.id === row.id ? { ...r, is_key: !!next } : r
    );
    setIngredients(optimistic);
    const { error } = await supabase
      .from("recipe_ingredients")
      .update({ is_key: !!next })
      .eq("id", row.id);
    if (error) {
      // revert on error
      setIngredients(ingredients);
      setErrorMsg("No se pudo actualizar. Inténtalo de nuevo.");
    }
  };

  const handleRemoveIngredient = async (row) => {
    setErrorMsg("");
    if (!row.id) {
      setIngredients(ingredients.filter((r) => r !== row));
      return;
    }
    const { error } = await supabase
      .from("recipe_ingredients")
      .delete()
      .eq("id", row.id);
    if (error) {
      setErrorMsg("No se pudo eliminar el ingrediente. Inténtalo de nuevo.");
      return;
    }
    const next = ingredients.filter((r) => r.id !== row.id);
    setIngredients(next);
    await refreshHasPending(next);
  };

  const handleStep4Next = async () => {
    setErrorMsg("");
    if (ingredients.length === 0) return;
    setBusy(true);
    const { error } = await supabase
      .from("recipes")
      .update({ draft_step: 5 })
      .eq("id", recipeId);
    setBusy(false);
    if (error) {
      setErrorMsg("No se pudo guardar. Inténtalo de nuevo.");
      return;
    }
    track("recipe_wizard_step_completed", { step: 4 });
    setStep(5);
  };

  // -------- Step 5 final save --------
  const persistFinalSave = async (cleanSteps) => {
    setBusy(true);

    // 1) replace previous recipe_steps (idempotent on re-saves)
    const del = await supabase
      .from("recipe_steps")
      .delete()
      .eq("recipe_id", recipeId);
    if (del.error) {
      setBusy(false);
      setErrorMsg(
        "No se pudo guardar la receta. Comprueba tu conexión e inténtalo de nuevo."
      );
      return;
    }
    const insertPayload = cleanSteps.map((instruction, idx) => ({
      recipe_id: recipeId,
      step_number: idx + 1,
      instruction,
    }));
    const ins = await supabase.from("recipe_steps").insert(insertPayload);
    if (ins.error) {
      setBusy(false);
      setErrorMsg(
        "No se pudieron guardar los pasos. Comprueba tu conexión e inténtalo de nuevo."
      );
      return;
    }

    // 2) Pull catalog nutrition for catalog ingredients
    const catalogIds = ingredients
      .filter((i) => i.ingredient_id)
      .map((i) => i.ingredient_id);
    let nutritionByIngId = new Map();
    if (catalogIds.length > 0) {
      const { data: cat } = await supabase
        .from("ingredients")
        .select(
          "id, base_unit, kcal_per_100, protein_per_100, carbs_per_100, fat_per_100, fiber_per_100"
        )
        .in("id", catalogIds);
      nutritionByIngId = new Map((cat || []).map((c) => [c.id, c]));
    }
    const enriched = ingredients.map((row) => ({
      ...row,
      ingredient: row.ingredient_id
        ? nutritionByIngId.get(row.ingredient_id) ?? null
        : null,
    }));
    const nutrition = computeNutritionPerServing(servings, enriched);

    // 3) Finalize the recipe row
    const hasPending = ingredients.some((x) => !!x.user_ingredient_id);
    const upd = await supabase
      .from("recipes")
      .update({
        is_draft: false,
        draft_step: null,
        has_pending_ingredients: hasPending,
        ...nutrition,
      })
      .eq("id", recipeId);
    setBusy(false);
    if (upd.error) {
      setErrorMsg(
        "No se pudo finalizar la receta. Comprueba tu conexión e inténtalo de nuevo."
      );
      return;
    }

    track("recipe_wizard_saved", {
      step_count: cleanSteps.length,
      ingredient_count: ingredients.length,
      has_pending_ingredients: hasPending,
    });
    navigate(`/my-recipes/${recipeId}`, { replace: true });
  };

  const handleFinalSave = async () => {
    setErrorMsg("");
    const cleanSteps = (stepsText || [])
      .map((s) => (s || "").trim())
      .filter((s) => s.length > 0);
    if (cleanSteps.length === 0) return;
    const trimmedTitle = (title || "").trim();
    const duplicate = await checkDuplicateTitle(trimmedTitle);
    if (duplicate) {
      track("recipe_duplicate_title_warning_shown", { step: 5 });
      setDuplicateDialog({
        open: true,
        step: 5,
        displayTitle: title,
        proceed: () => persistFinalSave(cleanSteps),
      });
      return;
    }
    await persistFinalSave(cleanSteps);
  };

  // -------- Duplicate-title dialog handlers --------
  const handleDuplicateConfirm = async () => {
    if (!duplicateDialog) return;
    const { step: warnStep, proceed } = duplicateDialog;
    track("recipe_duplicate_title_warning_resolved", {
      action: "save_anyway",
      step: warnStep,
    });
    setDuplicateDialog(null);
    if (typeof proceed === "function") await proceed();
  };

  const handleDuplicateCancel = () => {
    if (!duplicateDialog) return;
    const warnStep = duplicateDialog.step;
    track("recipe_duplicate_title_warning_resolved", {
      action: "edit_title",
      step: warnStep,
    });
    setDuplicateDialog(null);
    // If the warning surfaced on step 5, send the user back to step 1
    // so they can edit the title (Step1Title auto-focuses its input).
    if (warnStep === 5) setStep(1);
  };

  // -------- Close handler --------
  const handleCloseRequest = () => {
    setConfirmClose(true);
  };
  const handleConfirmExit = async () => {
    setConfirmClose(false);
    if (recipeId) {
      track("recipe_wizard_abandoned", { last_step: step });
    }
    navigate("/my-recipes");
  };

  // -------- Render --------
  if (bootstrapping) return <FullScreenLoader />;

  if (unsupported) {
    return (
      <MobileFrame>
        <WizardHeader
          currentStep={1}
          totalSteps={TOTAL_STEPS}
          onClose={() => navigate("/my-recipes")}
        />
        <ComingSoon
          title="Edición de recetas completadas"
          description="Próximamente podrás editar recetas ya guardadas. Por ahora solo puedes editar borradores."
        />
      </MobileFrame>
    );
  }

  const stepNode = (() => {
    if (step === 1)
      return (
        <Step1Title
          title={title}
          setTitle={setTitle}
          errorMsg={errorMsg}
          busy={busy}
          onNext={handleStep1Next}
        />
      );
    if (step === 2)
      return (
        <Step2Difficulty
          difficulty={difficulty}
          setDifficulty={setDifficulty}
          prepTime={prepTime}
          setPrepTime={setPrepTime}
          errorMsg={errorMsg}
          busy={busy}
          onBack={() => setStep(1)}
          onNext={handleStep2Next}
        />
      );
    if (step === 3)
      return (
        <Step3Servings
          servings={servings}
          setServings={setServings}
          errorMsg={errorMsg}
          busy={busy}
          onBack={() => setStep(2)}
          onNext={handleStep3Next}
        />
      );
    if (step === 4)
      return (
        <Step4Ingredients
          ingredients={ingredients}
          onAddIngredient={handleAddIngredient}
          onToggleKey={handleToggleKey}
          onRemoveIngredient={handleRemoveIngredient}
          errorMsg={errorMsg}
          busy={busy}
          onBack={() => setStep(3)}
          onNext={handleStep4Next}
        />
      );
    return (
      <Step5Steps
        steps={stepsText}
        setSteps={setStepsText}
        errorMsg={errorMsg}
        busy={busy}
        onBack={() => setStep(4)}
        onSave={handleFinalSave}
      />
    );
  })();

  return (
    <MobileFrame>
      <div data-testid="recipe-wizard" className="flex min-h-[100dvh] flex-1 flex-col">
        <WizardHeader
          currentStep={step}
          totalSteps={TOTAL_STEPS}
          onClose={handleCloseRequest}
        />
        <div className="flex flex-1 flex-col bg-surface-secondary">
          {stepNode}
        </div>
      </div>

      <ConfirmDialog
        open={confirmClose}
        title={
          recipeId ? "¿Salir del asistente?" : "¿Salir sin guardar?"
        }
        description={
          recipeId
            ? "Tus cambios se han guardado como borrador."
            : undefined
        }
        confirmLabel={recipeId ? "Salir" : "Salir sin guardar"}
        cancelLabel="Continuar editando"
        destructive={!recipeId}
        onConfirm={handleConfirmExit}
        onCancel={() => setConfirmClose(false)}
        testId="wizard-confirm-exit"
      />

      <ConfirmDialog
        open={!!duplicateDialog?.open}
        title="Ya tienes una receta llamada así"
        description={
          duplicateDialog
            ? `Tienes una receta titulada «${duplicateDialog.displayTitle}». ¿Quieres guardar esta de todos modos?`
            : undefined
        }
        confirmLabel="Guardar igualmente"
        cancelLabel="Editar título"
        onConfirm={handleDuplicateConfirm}
        onCancel={handleDuplicateCancel}
        testId="wizard-duplicate-title"
      />
    </MobileFrame>
  );
}
