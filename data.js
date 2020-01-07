// Add yourself. Insert an object at any point - it doesn't matter if you go before someone else as results are randomized.
const pages = [
  {
    name: 'Wes Bos',
    // Short description
    description: 'Web Developer, Tutorial Maker, Podcaster, BBQ Lover',
    // URL to your /uses page
    url: 'https://wesbos.com/uses',
    twitter: '@wesbos',
    // An emoji that describes you
    emoji: '🔥',
    // emoji of your country's flag
    country: '🇨🇦',
    // apple, windows or linux
    computer: 'apple',
    // apple or android
    phone: 'apple',
    // Tags
    // Dev Tags: Engineer, Developer, Designer, Front End, Back End, Full Stack,
    // Other: Tags: Entrepreneur, Teacher, Podcaster, YouTuber, Blogger, Speaker,
    // Language Tags: JavaScript, PHP, Rails, Ruby, TypeScript...
    tags: [
      'Developer',
      'Full Stack',
      'Entrepreneur',
      'Teacher',
      'YouTuber',
      'JavaScript',
    ],
  },
  {
    name: 'Troy Forster',
    // Short description
    description: 'Consulting Technology Director and CTO for Hire',
    // URL to your /uses page
    url: 'https://tforster.com/uses',
    twitter: '@tforster',
    // An emoji that describes you
    emoji: '',
    // emoji of your country's flag
    country: '🇨🇦',
    // apple, windows or linux
    computer: 'windows',
    // apple or android
    phone: 'android',
    // Tags
    // Dev Tags: Engineer, Developer, Designer, Front End, Back End, Full Stack,
    // Other: Tags: Entrepreneur, Teacher, Podcaster, YouTuber, Blogger, Speaker,
    // Language Tags: JavaScript, PHP, Rails, Ruby, TypeScript...
    tags: [
      'Engineer',
      'Back End',
      'Front End',
      'Consultant',
      'Entrepreneur',
      'JavaScript',
      'C#',
      'PHP',
      'Serverless',
      'SOA',
      'Enterprise',
    ],
  },
  {
    name: 'Kent C. Dodds',
    description: 'JavaScript Software Engineer, speaker, and trainer',
    url: 'https://kentcdodds.com/uses',
    emoji: '🙌',
    country: '🇺🇸',
    computer: 'apple',
    phone: 'android',
    tags: [
      'Developer',
      'Full Stack',
      'Entrepreneur',
      'Teacher',
      'YouTuber',
      'JavaScript',
      'Testing',
      'React',
      'Speaker',
      'Blogger',
    ],
  },
  {
    name: 'Adam Jahnke',
    description:
      'Caffiend, motorcyclist, climber, recovering perfectionist. I love to make the complex simple.',
    url: 'https://adamyonk.com/uses',
    emoji: '⤫',
    country: '🇺🇸',
    computer: 'apple',
    phone: 'apple',
    tags: ['Engineer', 'Full Stack', 'JavaScript', 'Ruby'],
  },
  {
    name: 'Andrew Healey',
    description: 'Software Engineer, Writer, Learner!',
    url: 'https://healeycodes.com/uses',
    emoji: '🦉',
    country: '🇬🇧',
    computer: 'apple',
    phone: 'apple',
    tags: ['Software Engineer', 'Full Stack', 'JavaScript', 'Python', 'Writer'],
  },
  {
    name: 'Scott Tolinski',
    description: 'Web Developer, Tutorial Maker, Podcaster, Bboy',
    url: 'https://kit.com/leveluptutorials/podcasting-screencasting-gear',
    emoji: '💪🏻',
    country: '🇺🇸',
    computer: 'apple',
    phone: 'apple',
    tags: ['Developer', 'FrontEnd', 'Entrepreneur', 'Teacher', 'JavaScript'],
  },
  {
    name: 'Benjamin Lannon',
    description: 'Web Developer, Open Source Contributor, Livestreamer',
    url: 'https://lannonbr.com/uses/',
    emoji: '🎤',
    country: '🇺🇸',
    computer: 'apple',
    phone: 'apple',
    tags: [
      'Developer',
      'Full Stack',
      'Blogger',
      'Teacher',
      'JavaScript',
      'GraphQL',
    ],
  },
  {
    name: 'Nuno Maduro',
    description: 'Software engineer, Open Source contributor, Speaker',
    url: 'https://nunomaduro.com/uses/',
    emoji: '🏄‍♂️',
    country: '🇵🇹',
    computer: 'apple',
    phone: 'apple',
    tags: [
      'Engineer',
      'Developer',
      'Speaker',
      'PHP',
      'JavaScript',
      'TypeScript',
    ],
  },
  {
    name: 'Adrian Marin',
    // Short description
    description: 'Product-Minded Software Engineer, Digital nomad, no-nonsense enjoyer of life, friends and family.',
    // URL to your /uses page
    url: 'https://adrianthedev.com/uses',
    twitter: '@adrianthedev',
    // An emoji that describes you
    emoji: '🥑',
    // emoji of your country's flag
    country: '🇷🇴',
    // apple, windows or linux
    computer: 'apple',
    // apple or android
    phone: 'apple',
    // Tags
    // Dev Tags: Engineer, Developer, Designer, Front End, Back End, Full Stack,
    // Other: Tags: Entrepreneur, Teacher, Podcaster, YouTuber, Blogger, Speaker,
    // Language Tags: JavaScript, PHP, Rails, Ruby, TypeScript...
    tags: [
      'Developer',
      'Full Stack',
      'Entrepreneur wanna-be',
      'Early-adopter',
      'Rails lover',
      'TypeScript enthusiast',
    ],
    uses: {
      computer: '2018 15inch MacBook Pro',
      software: {
        editor: ['VScode', 'vim'],
        programmingLanguages: ['ruby', 'typescript', 'php'],
        browser: 'Chrome',
        communication: ['Slack', 'Telegram'],
        terminal: 'iTerm2',
        productivity: ['Better Touch Tool', 'Alfred', 'RescueTime', 'Notion', 'Memory Diag', 'HapticKey', 'Karabiner'],
        security: ['1Password', 'Sophos'],
      },
      leisure: {
        apps: ['twitter', 'TikTok', 'Swarm'],
        games: ['Factorio', 'Two Dots'],
        misc: ['Kindle']
      }
    }
  }
];

export default pages;
