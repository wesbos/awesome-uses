# TODO

The home page needs to be more interesting. Some ideas:

- Most recently added or updated people?
- Hottest tools?

Products - what are people using? Can we show real photos here?
Software - would love to list out some software that people are using. Could we do multiple of these? Productiivity?

Thought: Some of the top items in every tag aren't interesting. MAcbook pro, Chrome, VS Code. Can we somehow filter those? Or use AI the find the interesting ones?

Idea for block: What AI Tools are people using?

Someone said I am interested in overlapping. What two tools always show up together?

filtering by country is def worth doing.

## Could we somehow get coding data from github?

Contributions Graph
Languages used (on repos in the last 4 years, or the most recent 50)
Repo Count
Follower Count
following Count
Commit count
Oldest commit or Date signed up for github?

Could we show a MegaCard for "noobs" and "Pros"?

Can we use the github data in context for vectorizing?

## Data we have

people

## Compounded

Is there some sort of block that we can make that is around tag or topic that would show a little bit of everything?

"The Ruby Dev". This could show: People, tags, items - software, items - products.

Could we have "topics" like Desk Setups that combine everything into a single card?

How would we find out what these "groupings" are? The Galaxy mode kind of does this already but the top items are all too similar

```md
people-store.ts - why do we eve need this?

We have a script that generates all the people data:

tsx ./scripts/sync-data-json.ts

1. this script could add the slugs and any other data needed
2. We can import this json anywhere we need it as an esmodule - use import assertions (import xx from xxx with ....)
3. The data.js file is currently a cjs file. We can swap this easily to an esm module by changing the module.exports to export default
```

Is it possible to somehow evaluate which frameworks or runtimes someone uses? Right now I have TypeScript, but I want to know is that Client side? React? Node? Bun? Hono? Don't write code, just tell me.
