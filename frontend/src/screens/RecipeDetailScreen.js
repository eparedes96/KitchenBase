import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { ComingSoon } from "@/components/common/ComingSoon";

/**
 * Placeholder screen for /my-recipes/:id (REC-003 will replace this).
 * If the recipe is actually a draft, redirect to the wizard to resume.
 */
export default function RecipeDetailScreen() {
  const { id } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("recipes")
        .select("id, is_draft")
        .eq("id", id)
        .maybeSingle();
      if (cancelled) return;
      if (data?.is_draft) {
        navigate(`/my-recipes/edit/${id}`, { replace: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, navigate]);

  return (
    <ComingSoon
      title="Detalle de receta"
      description="Pronto podrás ver toda la información de la receta aquí."
    />
  );
}
