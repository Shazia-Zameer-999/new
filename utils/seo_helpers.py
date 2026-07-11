"""
seo_helpers.py
---------------
Builds structured data (JSON-LD) and OpenGraph tags from content/business.json
and content/seo.json so the SEO layer stays fully config-driven too.
"""
import json


def build_local_business_schema(business: dict, seo: dict, testimonials: dict) -> str:
    schema = {
        "@context": "https://schema.org",
        "@type": seo.get("business_type", "JewelryStore"),
        "name": business.get("name"),
        "image": seo.get("og_image"),
        "telephone": business.get("phone"),
        "priceRange": "\u20b9\u20b9",
        "address": {
            "@type": "PostalAddress",
            "streetAddress": f"{business.get('address', {}).get('line1', '')}, {business.get('address', {}).get('line2', '')}",
            "addressLocality": business.get("address", {}).get("city"),
            "addressRegion": business.get("address", {}).get("state"),
            "postalCode": business.get("address", {}).get("pincode"),
            "addressCountry": "IN",
        },
        "geo": {
            "@type": "GeoCoordinates",
            "latitude": business.get("map_lat"),
            "longitude": business.get("map_lng"),
        },
        "aggregateRating": {
            "@type": "AggregateRating",
            "ratingValue": str(business.get("rating")),
            "reviewCount": str(business.get("review_count")),
        },
        "openingHoursSpecification": [
            {
                "@type": "OpeningHoursSpecification",
                "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
                "opens": "10:30",
                "closes": "20:00",
            },
            {
                "@type": "OpeningHoursSpecification",
                "dayOfWeek": ["Sunday"],
                "opens": "11:30",
                "closes": "18:30",
            },
        ],
    }
    return json.dumps(schema, ensure_ascii=False)
