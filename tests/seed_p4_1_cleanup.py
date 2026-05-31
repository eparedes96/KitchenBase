#!/usr/bin/env python3
"""
Cleanup companion to seed_p4_1_multicolor.py.

Removes ONLY the rows tagged with '(P4.1-seed)' / 'P4.1-seed' from the test
user's database. Pantry items added by the seed are NOT removed by default
(other flows depend on the pantry having content); pass --include-pantry
to also remove the pantry rows the seed created.

Run:
  python3 /app/tests/seed_p4_1_cleanup.py            # recipes + library only
  python3 /app/tests/seed_p4_1_cleanup.py --include-pantry
"""
import json
import os
import sys
import urllib.parse
import urllib.request
import urllib.error

SUPA_URL = "https://ldrxurbtrbjhxmrpdtjr.supabase.co"
SUPA_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
TEST_USER_ID = "18705db9-74a8-4a26-870d-f2a9435fb093"

SEEDED_TITLES = [
    "Ensalada Verde P4.1-seed",
    "Pollo con Arroz P4.1-seed",
    "Yogur con Miel P4.1-seed",
]
SEEDED_USER_INGREDIENT_NAME = "Miel P4.1-seed"

# Pantry rows the seed created (by ingredient catalog name). Removed only
# with --include-pantry.
SEEDED_PANTRY_CATALOG = [
    "Lechuga",
    "Aceite de oliva",
    "Sal",
    "Pechuga de pollo",
    "Arroz blanco",
    "Yogur natural",
]


def _req(method, path, params=None):
    url = SUPA_URL + path
    if params:
        url += ("&" if "?" in url else "?") + urllib.parse.urlencode(params)
    req = urllib.request.Request(
        url,
        method=method,
        headers={
            "apikey": SUPA_KEY,
            "Authorization": f"Bearer {SUPA_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            txt = resp.read().decode("utf-8")
            return resp.status, (json.loads(txt) if txt else None)
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode("utf-8") or "{}")


def main():
    include_pantry = "--include-pantry" in sys.argv

    # 1) Delete seeded recipes (library + recipe_ingredients + recipe_steps cascade)
    for title in SEEDED_TITLES:
        code, data = _req(
            "DELETE",
            "/rest/v1/recipes",
            params={"title": f"eq.{title}", "user_id": f"eq.{TEST_USER_ID}"},
        )
        deleted = len(data) if isinstance(data, list) else 0
        print(f"recipe '{title}': deleted {deleted}")

    # 2) Delete the quarantine ingredient (only if no other recipe_ingredient
    #    references it — otherwise the FK would block).
    code, ui = _req(
        "GET",
        "/rest/v1/user_ingredients",
        params={
            "name": f"eq.{SEEDED_USER_INGREDIENT_NAME}",
            "created_by": f"eq.{TEST_USER_ID}",
        },
    )
    if isinstance(ui, list) and ui:
        uid = ui[0]["id"]
        # also remove the pantry row for this quarantine ingredient
        _req("DELETE", "/rest/v1/pantry_items",
             params={"user_ingredient_id": f"eq.{uid}", "user_id": f"eq.{TEST_USER_ID}"})
        code, data = _req("DELETE", "/rest/v1/user_ingredients", params={"id": f"eq.{uid}"})
        print(f"user_ingredient '{SEEDED_USER_INGREDIENT_NAME}': delete code={code}")

    # 3) Optionally delete the catalog-backed pantry items the seed inserted.
    if include_pantry:
        # Fetch ingredient_ids for the named catalog ingredients
        names_csv = ",".join(SEEDED_PANTRY_CATALOG)
        code, ings = _req(
            "GET",
            "/rest/v1/ingredients",
            params={"name": f"in.({names_csv})", "select": "id,name"},
        )
        if isinstance(ings, list):
            for ing in ings:
                code, data = _req(
                    "DELETE",
                    "/rest/v1/pantry_items",
                    params={
                        "ingredient_id": f"eq.{ing['id']}",
                        "user_id": f"eq.{TEST_USER_ID}",
                    },
                )
                deleted = len(data) if isinstance(data, list) else 0
                print(f"pantry '{ing['name']}': deleted {deleted}")

    print("\nDONE.")


if __name__ == "__main__":
    main()
