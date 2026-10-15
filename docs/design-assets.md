# Homepage demo cover assets

Created October 15, 2026 with the built-in image-generation tool, under the imagegen skill. These are AI-generated interior concepts for explicitly fictional sample listings. They are featured-homepage artwork, not photographs of actual properties. Ordinary uploaded listing photos and existing galleries are preserved.

Final assets:

- `frontend/public/images/demo/twin-room.webp` — Near Campus Twin Dorm, 123,958 bytes.
- `frontend/public/images/demo/studio-room.webp` — Premium Study Loft, 106,976 bytes.
- `frontend/public/images/demo/shared-room.webp` — Mixed Availability Dorm, 98,656 bytes.

Each cover is 960px wide, WebP quality 0.86. The generated PNG originals are retained in the ignored `.local/demo-image-originals` directory and the generator's original output directory. The application retains exact selected-room links and displays an AI demo illustration badge. The alternative text and badge tooltip identify fictional generated interiors. Covers are selected only when both the specific sample title and `is_demo` match.

## Final prompt set

### twin

Use case: photorealistic-natural. Asset: a 4:3 featured fictional student-housing cover for DormFinder. Create an original, convincingly photographed but clearly concept-only modest twin student dorm room: exactly two simple single beds, white cotton bedding with cobalt and muted navy accents, shared pale wood study desk with books, practical wardrobe, white plaster walls, tiled floor, one large side window with soft tropical daylight. Cozy attainable Manila student housing, compact but clean, thoughtful composition, realistic linen and wood textures, no luxury hotel styling. Wide interior view from the doorway at eye level, believable proportions and perspective, slightly editorial natural light. Main room fills the entire landscape image with no borders, no collage, no typography, no logos, no people, no watermark. Calm white, navy, blue and natural wood palette; generous detail and dimensional light. This is fictional demo artwork, not an actual rental photograph; labeling is added by the application.

### studio

Use case: photorealistic-natural. Asset: a 4:3 featured fictional student-housing cover for DormFinder. Create an original, convincingly photographed concept of a compact independent student study studio: one single bed with crisp white bedding and a soft navy throw, a distinctive long light-wood desk below a sunlit window, simple chair, closed storage cabinet, a few books and a small plant. Modest practical student room in Manila, white plaster, pale tile flooring, cobalt-blue accent on desk accessories, no opulent furniture or extravagant decor. A wide editorial interior composition from the doorway, with bed and desk both clearly visible, realistic proportions, soft bright morning tropical daylight and gentle directional shadows. Landscape image filled by one complete room, no borders, no collage, no typography, no logos, no people, no watermark. White, navy, blue and natural wood palette, finely textured linen and realistic materials. Fictional demo artwork, not an actual rental photograph; application provides the demo label.

### shared

Use case: photorealistic-natural. Asset: a 4:3 featured fictional student-housing cover for DormFinder. Create an original, natural-looking concept interior image of a tidy shared student dorm in Manila: four simple single beds arranged along the two sides, white bedding with restrained blue and navy throws, practical individual storage, two compact pale-wood study desks, white walls, tiled floor, daylight from windows at the far end. Economical attainable shared student housing, clean and welcoming rather than a hotel or luxury apartment. Wide eye-level view from the doorway showing the shared-room layout with believable perspective and proportion, soft tropical afternoon light, real textures and natural soft shadows. One room fills a landscape 4:3 image, no borders, no collage, no text, no logos, no people, no watermark. Calm white, navy and cobalt highlights balanced with natural wood. This is fictional demo artwork, not a real rental photograph; the application adds clear demo labeling.

## Typography

Inter is self-hosted as a 48,256-byte Latin variable WOFF2 from the official Google Fonts distribution, with the author's OFL license retained in `frontend/public/fonts/Inter-OFL.txt`. Font source: [Inter](https://rsms.me/inter/) and [Google Fonts](https://fonts.google.com/specimen/Inter). There are no runtime font-service requests.
