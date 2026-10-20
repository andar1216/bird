// Demo conversations used by the "demo" adapter. `ago` is minutes before now.
const G = {
  pink: ['#ff7eb3', '#ff4d8d'],
  orange: ['#ffb36b', '#ff7a45'],
  green: ['#8ee27a', '#2fbf71'],
  teal: ['#6fe0d6', '#1fa2b8'],
  blue: ['#7fb2ff', '#3d6bff'],
  purple: ['#c59bff', '#8a52ff'],
  gray: ['#c9ccd6', '#9298a8'],
  yellow: ['#ffe36b', '#ffb800'],
}

const them = (text, ago, extra = {}) => ({ from: 'them', text, ago, ...extra })
const me = (text, ago, extra = {}) => ({ from: 'me', text, ago, ...extra })
const DAY = 24 * 60

export const DEMO_CHATS = [
  {
    externalId: 'lou', network: 'instagram', name: 'Lou', handle: '@lou.makes',
    colors: G.pink, pinned: true,
    messages: [
      them('ok but did you see the new Beeper update??', 134),
      me('lol obviously. the gradients are unreal', 129),
      them('we need our own version', 123),
      them('yea, I think so...', 120),
    ],
  },
  {
    externalId: 'roma', network: 'snapchat', name: 'Roma', handle: 'roma.sk8',
    colors: G.orange, pinned: true, streak: 42,
    messages: [
      them('snap streak day 42 🔥', 133),
      me("don't you dare let it die", 128),
      { from: 'them', type: 'image', caption: 'proof of life', ago: 120 },
    ],
  },
  {
    externalId: 'eric', network: 'discord', name: 'Eric', handle: 'eric#0042',
    colors: G.teal, pinned: true, unread: 33,
    messages: [
      them('who is up for ranked tonight', 205),
      them('I can play after 8', 204),
      them('hello??', 195),
      them("something's happening in #general", 185),
    ],
  },
  {
    externalId: 'karl', network: 'messages', name: 'Karl Kraus', handle: '+1 (555) 014-2290',
    colors: G.green,
    messages: [me('Dinner at 7?', 360), them('Why do you think that?', 120)],
  },
  {
    externalId: 'pierre', network: 'instagram', name: 'Pierre Melville', handle: '@pierre.m',
    colors: G.blue,
    messages: [me('Did you make the reservation?', 190), them('… Oui. C’est parfait!', 150)],
  },
  {
    externalId: 'elizabeth', network: 'messages', name: 'Elizabeth Morgan', handle: '+1 (555) 019-7731',
    colors: G.gray, unread: 2,
    messages: [them('I guess we can do something about it on Monday.', 185)],
  },
  {
    externalId: 'roy', network: 'discord', name: 'Roy Leblanc', handle: 'roy_l',
    colors: G.purple, muted: true, unread: 4,
    messages: [them('Hey! How are you? Wow, it’s been awhile. What have you been up to?', 250)],
  },
  {
    externalId: 'vince', network: 'snapchat', name: 'Vince Davidson', handle: 'vincedavi',
    colors: G.yellow,
    messages: [them('Did we track the registration of the steps in there, or did…', 300)],
  },
  {
    externalId: 'cafe', network: 'messages', name: 'Café Ladies', handle: 'Group · 5 people',
    colors: G.pink, group: true, unread: 3, mention: true,
    messages: [
      them('Are you ready? We’re getting ready to leave now!', 520, { sender: 'Maya' }),
      them('@you bring the cake pls 🍰', 500, { sender: 'Jo' }),
    ],
  },
  {
    externalId: 'pixel', network: 'discord', name: 'Pixel Pals', handle: '#general · 128 online',
    colors: G.blue, group: true,
    messages: [
      them('new emote pack just dropped', DAY + 60, { sender: 'nova' }),
      them('ok that one is actually clean', DAY + 55, { sender: 'kai' }),
      me('adding it to the server now', DAY + 50),
    ],
  },
  {
    externalId: 'paityn', network: 'instagram', name: 'Paityn Ahmed', handle: '@paityn',
    colors: G.teal, muted: true,
    messages: [
      them('Did we track the registration of the steps in there, or did…', DAY + 90),
      me(undefined, DAY + 80, { type: 'voice', duration: '0:14' }),
    ],
  },
  {
    externalId: 'sam', network: 'messages', name: 'Sam (work)', handle: '+1 (555) 010-4482',
    colors: G.orange, lowPriority: true,
    messages: [them('Your package is out for delivery 📦', 2 * DAY)],
  },
  {
    externalId: 'oldcrew', network: 'snapchat', name: 'Old Crew', handle: 'Group · 8 people',
    colors: G.gray, group: true, archived: true,
    messages: [them('remember summer 2019', 40 * DAY, { sender: 'Dee' })],
  },
]
