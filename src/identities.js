export const FACTIONS = {
  unaffiliated: {name:'Unaffiliated',palette:null,description:'An independent soul, in their own colors.'},
  mossbound: {name:'The Mossbound',palette:'moss',description:'Forest green, weathered copper, and woodland craft.'},
  emberguard: {name:'The Emberguard',palette:'ember',description:'Ember red and iron, from the mountain forges.'},
  tidewatch: {name:'The Tidewatch',palette:'tide',description:'Deep blue and silver, under a coastal banner.'},
  violet_coven: {name:'The Violet Coven',palette:'plum',description:'Plum and old gold, keepers of quiet mysteries.'},
  golden_hearth: {name:'The Golden Hearth',palette:'ochre',description:'Harvest ochre and warm earth, a home for every trade.'},
};
export const CLASSES = {
  custom:{name:'Custom',description:'Your own combination of parts and equipment.'},
  witch:{name:'Witch',description:'A broad pointed hat, a long coat, and a curious mind.',hat:['wizard'],body:['coat'],equipment:'none'},
  gnome:{name:'Gnome',description:'A tall cap, a sturdy tunic, and a trusty mining pick.',hat:['cap'],body:['tunic'],equipment:'pickaxe'},
  knight:{name:'Knight',description:'A crested helm, plate armor, and a faction-colored tabard.',hat:['helmet'],body:['armor'],equipment:'sword'},
  townsfolk:{name:'Townsfolk',description:'Aprons, everyday tunics, and familiar faces.',hat:['none','ranger'],body:['apron','tunic'],equipment:'none'},
};
