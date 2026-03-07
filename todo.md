Person page improvements.

1. It should show the users avatar on their page. Extract the avatar logic into it's own function and component so it can be re-used throughout the site.
2. we should also show which country they are from in text (derived from their emoji) along with the emoji.
3. We should also display their socials. Again we may need to refactor some of the PersonCard.tsx logic out into their own function and/or components.

Instead of "Visit their /uses page". It should show their url, highlighting /uses in --yellow.

make it nice and clean, so https://wesbos.com/uses will show simply wesbos.com/uses.

Create a facts component that will display the following interesting facts:

- The Shortest and longest names
- The shortest and longest domain names
- The 5 most common TLDs, and and 5 least common
- The 5 most common items

## Item Page Improvements

The /items/ITEM page is all client side loaded. I want this to be loaded server side so we don't ever see a loader.

## SEO Audit

The whole website needs good SEO. Please go page by page and implemnt all the tags needed. Make sure to create an opengraph card as well with https://github.com/kvnang/workers-og/

## Better Person Page

On the items page, under "people using this item", I'd like this to be a bit more detailed.

Could you make a smaller person card component that show theit avatar, their name and their bio?

## Avatar Fixing

We are using unavatar for avatars here. You currently have unavatar logic in two places. Please fix that.

Please also craft a nice long string with multiple fallbacks. First x, then github ID, then Bluesky, then website and anything else you think you can use. Hopefully through this we will be able to have avatars for everyone.

## Similarity Score

Can you Vectorize each person's /uses page scrape and then using cosine similarity display similar people? Use Cloudflare Vectorize

## Create a /uses skill

Please visit the tags page (http://localhost:7535/tags) and query the database for several scrapes of users /uses pages to get an idea of what type of content is included.

Then write a skill that will

- prompt the user with questions about their setup
- run a script to gather computer, display and accessory data
- Continually review and ask questions in follow up
- Export their /uses page in markdown, rich text, HTML or JSX.

## Create an "add your own /uses" page

Make a /add page with instruction on how to add your own. There should be rules:

1. Add a /uses page to your website documenting your current setup. [please inject a description of things to include in your own uses page]. This page must be /uses. Nothing else will be accepted.
2. Submit to the PR

## Add a Uses/uses page

This page will document the tech stack used to make /uses . Please fill this out with all the tech used.

## Home Page Hero

The home page needs a landing hero. It should be.:

/uses
A list of /uses pages detailing developer setups, gear, software and configs.
Add your own! [link to add your own page]
