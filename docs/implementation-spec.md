# Product Updates Blog Implementation Spec

Product Blog  
Requirements

1. Goal and audience

What the blog is for (trust, release transparency, customer education, etc.)

- The aim of the blog is two-fold. One is to celebrate the features we are shipping as a Product team at FreeAgent. But the second aim is to shift the perception of who FreeAgent is for. Our goal is to tell the connected story of how all those features have developed over time into a more complete package that is a stronger fit for our primary target audience of accountants.

Primary reader types (admins, PMs, developers, execs)

- Primary audience is Accountants and bookkeepers  
- Secondary audience is Small Business owners  
2. Visual direction

3 to 5 adjectives (for example: editorial, confident, minimal, technical)

- Smart: Be the quietly confident expert. Spotlight what matters most to the reader right now. Translate technical finance into digestible steps.   
- Human: Talk like a real person to a real person. Always use Active Voice (e.g., "We're doing this" vs "This is being done"). Be empathetic—show you’ve been there.  
- Friendly: Be non-judgmental and peer-to-peer. Anticipate the reader's next question. Always focus on the Benefit over the Feature.  
- Playful: Be witty and "cheeky." It’s okay to have a swipe at the status quo or the competition. Use pop-culture references or "insider" humour.

2 to 3 reference sites you like, plus what you like about each

- Xero innovations ([https://innovations.xero.com/](https://innovations.xero.com/)) \- I like the flexibility of the filters to change the story of what is being shown. The headline feature blog gives context to the subset of grouped features.  
- Quickbooks product updates ([https://quickbooks.intuit.com/uk/product-updates/](https://quickbooks.intuit.com/uk/product-updates/)) \- I like the visual identity and the use of UI elements. I really like slide-in sidebar element as a read-more option to dig deeper into the new feature.

Brand constraints: colors, fonts, logo usage, spacing density, tone

- Utilise the brand guidelines existing for FreeAgent at [https://www.freeagent.com/timeline/](https://www.freeagent.com/timeline/)  
- I can also provide a full set of tone of voice guidelines as well as needed.

Things you do not want (for example: no card-heavy layout, no dark mode, no gradients)

- Happy to see what comes out and tweak.  
3. Information architecture

Required sections on the homepage

- Split view between a sidebar and primary scrolling view. I can provide layout design mock images as well.  
- Filter in sidebar controls the selected tags that are displayed  
- Primary view is split into a hero header block, potentially in a carousel, above a body block of stacked cards in a grid pattern.   
- Each card is an individual product update consisting of Image, Tag(s), Title, Body, link to read more

Required sections on a single update page

- Image, Tag(s), Title, Body, Link to read more 

Navigation structure (top nav, filters, search, archive, categories, tags)

- Single blog page  
- Sidebar slide in as preview of product updates  
- Within preview, links to external pages within FreeAgent blog ([https://www.freeagent.com/blog/](https://www.freeagent.com/blog/))  
-   
4. Functional requirements

Must-have features now (v1)

- Card content displaying multiple features  
- Tags to enable filtering by content type  
- Sidebar preview of update content  
- Sidebar filter control to select tags

Nice-to-have features later (v2)

- Images with zoom effects  
- Carousel hero section with multiple hero feature promotions  
5. Content model (without writing real content yet)  
- Image \- Required, Order 1  
- Tag(s) \- Required, Order 2  
- Title \- Required, Order 3  
- Body \- Required, Order 4  
- Link to read more \- Required, Order 5  
6. Interaction and motion  
- No requirements at present  
7. Success criteria  
- A functional blog page with multiple update cards that can be filtered into a subset collection. Each product update can trigger a sidebar view of the content. Any provided external links will redirect and load in a separate tab.