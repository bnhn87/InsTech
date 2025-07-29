"""
InsTech quote engine
====================

This module implements a simple quote engine for the InsTech MVP.

Unlike traditional price‑based quoting, the InsTech platform focuses on
**installation hours** rather than monetary cost.  Each product line is
associated with a defined installation duration (in hours per unit), and
the total labour requirement for a project is the sum of all product
quantities multiplied by their respective install times.

In a production setting, you might fetch install times from your ERP
system, a dedicated quoting microservice or a data store.  For the
purposes of this MVP, install times are stored in a simple lookup table
(`INSTALL_TIME_PER_PRODUCT`) which you should customise to match your
real products.

If a product code is missing from the lookup table, a default install
time of `DEFAULT_HOURS_PER_UNIT` is used.  You can adjust this value to
reflect your typical installation duration for unknown items.
"""

from __future__ import annotations

from typing import List, Dict, Any

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# Default installation time (in hours per unit) for products that are not
# explicitly defined in the lookup table.  Adjust this value to reflect
# your average installation duration for unknown items.
DEFAULT_HOURS_PER_UNIT: float = 1.0

# Lookup table mapping product codes to installation time (hours per unit).
# You **must** populate this dictionary with real data from your "Quoting
# with hours" project or internal data source.  For demonstration
# purposes a handful of example codes are provided.  Replace or extend
# this mapping as needed.
INSTALL_TIME_PER_PRODUCT: Dict[str, float] = {
    "RS-CHAIR-01": 0.5,  # Example: Rawside chair takes 0.5 hours to install
    "RS-DESK-02": 1.0,
    "RS-CABINET-03": 1.5,
    # Add further product codes and their installation times here...
}


def request_quote(project: Dict[str, Any], products: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Compute an installation‑time quote for a project.

    Args:
        project: A dictionary containing project details (e.g. labour
            required, duration, address).  This function ignores
            `labour_required` and instead derives total hours from
            product quantities and install times.
        products: A list of products with at least `code`, `name` and
            `quantity` fields.

    Returns:
        A dictionary representing the installation‑time quote.  For example:

        ```json
        {
          "total_hours": 12.5,
          "line_items": [
            {"code": "RS-CHAIR-01", "name": "Rawside Chair", "quantity": 5, "hours_per_unit": 0.5, "total_hours": 2.5},
            ...
          ]
        }
        ```

    Note:
        - If a product's code is not found in `INSTALL_TIME_PER_PRODUCT`,
          `DEFAULT_HOURS_PER_UNIT` is used.
        - The `project` argument is currently unused but included for
          future extensibility (e.g. factoring in travel time or
          environment constraints).
    """
    line_items: List[Dict[str, Any]] = []
    total_hours = 0.0

    for product in products:
        code = product.get("code") or "UNKNOWN"
        quantity = float(product.get("quantity") or 0)
        # Look up install time; fallback to default if not found
        hours_per_unit = INSTALL_TIME_PER_PRODUCT.get(code, DEFAULT_HOURS_PER_UNIT)
        item_hours = hours_per_unit * quantity
        total_hours += item_hours
        line_items.append({
            "code": code,
            "name": product.get("name"),
            "quantity": quantity,
            "hours_per_unit": hours_per_unit,
            "total_hours": item_hours,
        })

    return {
        "total_hours": total_hours,
        "line_items": line_items,
    }
