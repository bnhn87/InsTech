"""
Stub for searching product images on the internet to use as pin thumbnails.

In a production system you would integrate with an external image API
such as Unsplash, Pexels or Google Custom Search.  The function
defined here demonstrates the interface and returns dummy data.  You
need to supply your own API key and implement the HTTP requests.
"""

from __future__ import annotations

from typing import List, Dict


def search_images(query: str, max_results: int = 5) -> List[Dict[str, str]]:
    """
    Search for images matching the query.

    Args:
        query: Search query, e.g. a product name or code.
        max_results: Maximum number of images to return.

    Returns:
        A list of dictionaries containing image URLs and metadata.

    Example return value:

        ```json
        [
          {"url": "https://images.example.com/photo1.jpg", "description": "Product photo"},
          ...
        ]
        ```

    Note:
        This stub returns an empty list.  Replace it with actual API calls.
    """
    # TODO: integrate with an external image search API
    return []