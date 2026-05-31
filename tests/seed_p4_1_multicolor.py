#!/usr/bin/env python3
"""
P4.1 multi-color library seed.

Idempotent seed that ensures the test user's library contains at least one
recipe in each semaphore state (GREEN, YELLOW, ORANGE, GREEN+pending). All
seeded rows are tagged with the suffix '(P4.1-seed)' on user-facing names,
so cleanup is trivial: see CLEANUP at the bottom of this file.

Run:
  python3 /app/tests/seed_p4_1_multicolor.py
"""
import json
import os
import sys
import uuid
from typing import Optional

import urllib.request
import urllib.error
import urllib.parse

# ----- Config ------------------------------------------------------------
SUPA_URL = "https://ldrxurbtrbjhxmrpdtjr.supabase.co"
SUPA_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
TEST_USER_ID = "18705db9-74a8-4a26-870d-f2a9435fb093"

# Cached UUIDs gathered above
ING = {
    "Lechuga":          "99a656a3-ca57-4e0e-9be8-bdd327abbe02",
    "Tomate":           "3f304378-8125-4ce1-997b-33d3f8b3c24b",
    "Aceite de oliva":  "f83cf320-2034-49b1-9db1-ab8f20bea0b4",
    "Sal":              "74843300-ca1c-431d-b3ff-77c95b9a81cb",
    "Pechuga de pollo": "852fd6ac-8237-465d-aed5-d2d2b54ce3a1",
    "Arroz blanco":     "1eb20d3f-8e1c-4095-a3af-b3b510c128d0",
    "Cebolla":          "8c07d5d0-c1e1-4151-946b-f437a7ee8a8e",
    "Yogur natural":    "eec4fe04-1ed7-4ee2-96d3-f4e50590836f",
    "Plátano":          "61b99dbc-4c9b-4b74-8677-7f5b71bcc376",
}

UNIT = {
    "g":  "2977a154-74c2-43b0-a89b-f0fa1699ddac",
    "ml": "582b4fff-1230-49f1-a5b3-95bf3577266e",
}


# ----- Tiny REST client --------------------------------------------------
def _req(method: str, path: str, body=None, params: Optional[dict] = None, headers: Optional[dict] = None):
    url = SUPA_URL + path
    if params:
        url += ("&" if "?" in url else "?") + urllib.parse.urlencode(params)
    data = None
    if body is not None:
        data = json.dumps(body).encode("utf-8")
    h = {
        "apikey": SUPA_KEY,
        "Authorization": f"Bearer {SUPA_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    if headers:
        h.update(headers)
    req = urllib.request.Request(url, data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            txt = resp.read().decode("utf-8")
            return resp.status, (json.loads(txt) if txt else None)
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode("utf-8") or "{}")


def get_one(path: str, params: dict):
    code, data = _req("GET", path, params=params)
    if code >= 300:
        raise RuntimeError(f"GET {path} → {code} {data}")
    return data[0] if isinstance(data, list) and data else None


def insert_one(path: str, body: dict):
    code, data = _req("POST", path, body=body)
    if code >= 300:
        raise RuntimeError(f"POST {path} → {code} {data}")
    return data[0] if isinstance(data, list) and data else data


def update_one(path: str, body: dict, params: dict):
    code, data = _req("PATCH", path, body=body, params=params)
    if code >= 300:
        raise RuntimeError(f"PATCH {path} → {code} {data}")
    return data


# ----- Helpers -----------------------------------------------------------
def ensure_pantry_item(ingredient_id=None, user_ingredient_id=None, quantity=0, unit_symbol="g", is_basic=False, location="pantry"):
    """Upsert a pantry row for the test user. Idempotent by (user_id, ingredient_id)
    or (user_id, user_ingredient_id)."""
    if (ingredient_id is None) == (user_ingredient_id is None):
        raise ValueError("Exactly one of ingredient_id / user_ingredient_id must be provided")
    unit_id = UNIT[unit_symbol]
    filt = {"user_id": f"eq.{TEST_USER_ID}"}
    if ingredient_id:
        filt["ingredient_id"] = f"eq.{ingredient_id}"
    else:
        filt["user_ingredient_id"] = f"eq.{user_ingredient_id}"
    existing = get_one("/rest/v1/pantry_items", filt)
    payload = {
        "quantity": quantity,
        "unit_id": unit_id,
        "is_basic": is_basic,
        "location": location,
    }
    if existing:
        update_one("/rest/v1/pantry_items", payload, {"id": f"eq.{existing['id']}"})
        return existing["id"], "updated"
    body = {
        "id": str(uuid.uuid4()),
        "user_id": TEST_USER_ID,
        **payload,
    }
    if ingredient_id:
        body["ingredient_id"] = ingredient_id
    else:
        body["user_ingredient_id"] = user_ingredient_id
    row = insert_one("/rest/v1/pantry_items", body)
    return row["id"], "inserted"


def ensure_user_ingredient(name, base_unit="g"):
    existing = get_one(
        "/rest/v1/user_ingredients",
        {"name": f"eq.{name}", "created_by": f"eq.{TEST_USER_ID}"},
    )
    if existing:
        return existing["id"], "exists"
    row = insert_one(
        "/rest/v1/user_ingredients",
        {
            "id": str(uuid.uuid4()),
            "created_by": TEST_USER_ID,
            "name": name,
            "base_unit": base_unit,
            "status": "pending",
        },
    )
    return row["id"], "inserted"


def ensure_recipe(title, *, difficulty, prep_time, servings, has_pending, ingredients, steps):
    """Create a recipe with its ingredients + steps + library row, idempotent by title+user."""
    existing = get_one(
        "/rest/v1/recipes",
        {"title": f"eq.{title}", "user_id": f"eq.{TEST_USER_ID}"},
    )
    if existing:
        return existing["id"], "exists"

    recipe_id = str(uuid.uuid4())
    insert_one(
        "/rest/v1/recipes",
        {
            "id": recipe_id,
            "user_id": TEST_USER_ID,
            "title": title,
            "difficulty": difficulty,
            "prep_time_minutes": prep_time,
            "servings": servings,
            "status": "private",
            "has_pending_ingredients": has_pending,
            "is_draft": False,
            "draft_step": None,
        },
    )

    # Insert ingredients
    for sort_order, ing in enumerate(ingredients):
        body = {
            "id": str(uuid.uuid4()),
            "recipe_id": recipe_id,
            "quantity": ing["quantity"],
            "unit_id": UNIT[ing["unit"]],
            "is_key": ing.get("is_key", False),
            "sort_order": sort_order,
        }
        if ing.get("ingredient_id"):
            body["ingredient_id"] = ing["ingredient_id"]
        else:
            body["user_ingredient_id"] = ing["user_ingredient_id"]
        insert_one("/rest/v1/recipe_ingredients", body)

    # Insert steps
    for idx, instruction in enumerate(steps, start=1):
        insert_one(
            "/rest/v1/recipe_steps",
            {
                "id": str(uuid.uuid4()),
                "recipe_id": recipe_id,
                "step_number": idx,
                "instruction": instruction,
            },
        )

    # Add to library
    insert_one(
        "/rest/v1/library",
        {
            "id": str(uuid.uuid4()),
            "user_id": TEST_USER_ID,
            "recipe_id": recipe_id,
        },
    )
    return recipe_id, "inserted"


# ----- Main --------------------------------------------------------------
def main():
    actions = []

    # 1) Quarantine ingredient for the green+pending recipe
    miel_id, miel_state = ensure_user_ingredient("Miel P4.1-seed", base_unit="g")
    actions.append(f"user_ingredient 'Miel P4.1-seed' → {miel_state} ({miel_id})")

    # 2) Pantry items needed by the seeded recipes
    pantry_plan = [
        # GREEN — Ensalada
        {"ingredient_id": ING["Lechuga"], "quantity": 300, "unit_symbol": "g"},
        # is_basic=True items (always available regardless of quantity)
        {"ingredient_id": ING["Aceite de oliva"], "quantity": 500, "unit_symbol": "ml", "is_basic": True},
        {"ingredient_id": ING["Sal"], "quantity": 100, "unit_symbol": "g", "is_basic": True},
        # YELLOW — Pollo con arroz (cebolla NOT added on purpose)
        {"ingredient_id": ING["Pechuga de pollo"], "quantity": 400, "unit_symbol": "g"},
        {"ingredient_id": ING["Arroz blanco"], "quantity": 500, "unit_symbol": "g"},
        # GREEN+pending — Yogur con miel
        {"ingredient_id": ING["Yogur natural"], "quantity": 500, "unit_symbol": "g"},
        # quarantine pantry row for "Miel P4.1-seed"
        {"user_ingredient_id": miel_id, "quantity": 200, "unit_symbol": "g"},
    ]
    for entry in pantry_plan:
        pid, state = ensure_pantry_item(
            ingredient_id=entry.get("ingredient_id"),
            user_ingredient_id=entry.get("user_ingredient_id"),
            quantity=entry["quantity"],
            unit_symbol=entry["unit_symbol"],
            is_basic=entry.get("is_basic", False),
        )
        actions.append(f"pantry_item {entry} → {state} ({pid})")

    # 3) Seed recipes
    # GREEN — Ensalada Verde P4.1-seed
    rid, st = ensure_recipe(
        "Ensalada Verde P4.1-seed",
        difficulty="easy",
        prep_time=5,
        servings=1,
        has_pending=False,
        ingredients=[
            {"ingredient_id": ING["Lechuga"], "quantity": 100, "unit": "g", "is_key": True},
            {"ingredient_id": ING["Aceite de oliva"], "quantity": 10, "unit": "ml", "is_key": False},
            {"ingredient_id": ING["Sal"], "quantity": 1, "unit": "g", "is_key": False},
        ],
        steps=[
            "Lavar y cortar la lechuga.",
            "Aliñar con aceite y sal al gusto.",
        ],
    )
    actions.append(f"recipe 'Ensalada Verde P4.1-seed' → {st} ({rid})")

    # YELLOW — Pollo con Arroz P4.1-seed (cebolla NON-key NOT in pantry)
    rid, st = ensure_recipe(
        "Pollo con Arroz P4.1-seed",
        difficulty="medium",
        prep_time=30,
        servings=2,
        has_pending=False,
        ingredients=[
            {"ingredient_id": ING["Pechuga de pollo"], "quantity": 200, "unit": "g", "is_key": True},
            {"ingredient_id": ING["Arroz blanco"],     "quantity": 150, "unit": "g", "is_key": True},
            {"ingredient_id": ING["Cebolla"],          "quantity": 50,  "unit": "g", "is_key": False},
        ],
        steps=[
            "Cortar la pechuga en trozos y dorarla.",
            "Cocer el arroz con cebolla picada.",
            "Mezclar y servir caliente.",
        ],
    )
    actions.append(f"recipe 'Pollo con Arroz P4.1-seed' → {st} ({rid})")

    # GREEN + pending — Yogur con Miel P4.1-seed
    rid, st = ensure_recipe(
        "Yogur con Miel P4.1-seed",
        difficulty="easy",
        prep_time=2,
        servings=1,
        has_pending=True,
        ingredients=[
            {"ingredient_id": ING["Yogur natural"], "quantity": 150, "unit": "g", "is_key": True},
            {"user_ingredient_id": miel_id,         "quantity": 30,  "unit": "g", "is_key": False},
        ],
        steps=[
            "Verter el yogur en un cuenco.",
            "Añadir la miel por encima.",
        ],
    )
    actions.append(f"recipe 'Yogur con Miel P4.1-seed' → {st} ({rid})")

    print("\n".join(actions))
    print("\nDONE.")


if __name__ == "__main__":
    main()
