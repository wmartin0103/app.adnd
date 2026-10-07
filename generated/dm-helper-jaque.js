/* ── Generated from character sheet saves: Jaque ──
   Paste just above:  const STORE_KEY='adnd-init-tracker';
   Replaces these characters' hand-typed entries; other characters are untouched. */
Object.assign(CHARACTERS, {
  "Jaque": {
    "level": 5,
    "armor": {
      "ac": 4,
      "shieldless": 4,
      "surprised": 8
    },
    "baseTHAC0": 18,
    "initBonus": 0,
    "stats": {
      "str": 13,
      "dex": 19,
      "con": 15,
      "int": 16,
      "wis": 13,
      "cha": 15
    },
    "quickness": {
      "bonus": -2
    },
    "weapons": {
      "Superior Dagger": {
        "modes": {
          "melee": {
            "thac0": 13,
            "speed": 2
          },
          "thrown": {
            "thac0": 13,
            "speed": 2
          }
        }
      },
      "Leprechaun Dagger": {
        "modes": {
          "melee": {
            "thac0": 13,
            "speed": 2
          },
          "thrown": {
            "thac0": 13,
            "speed": 2
          }
        }
      },
      "Wave Dagger": {
        "modes": {
          "melee": {
            "thac0": 14,
            "speed": 2
          },
          "thrown": {
            "thac0": 14,
            "speed": 2
          }
        }
      },
      "Dagger x6, thrown": {
        "thac0": 14,
        "speed": 2
      },
      "Trick Throw": {
        "thac0": 16,
        "speed": 2
      }
    },
    "secondary": [
      {
        "name": "Off-hand Dagger x6",
        "modes": {
          "melee": {
            "thac0": 16
          },
          "thrown": {
            "thac0": 16
          }
        }
      },
      {
        "name": "Superior Dagger (2nd; melee alt. rounds)",
        "modes": {
          "melee": {
            "thac0": 13
          },
          "thrown": {
            "thac0": 13
          }
        }
      },
      {
        "name": "Superior Dagger (3rd; thrown)",
        "thac0": 13
      }
    ]
  }
});
Object.assign(SKILLS, {
  "Jaque": {
    "Observation": {
      "t": 16,
      "src": ""
    },
    "Fast-Talking": {
      "t": 15,
      "src": ""
    },
    "Information Gathering": {
      "t": 16,
      "src": ""
    },
    "Quickness": {
      "t": 16,
      "src": ""
    },
    "Locksmithing": {
      "t": 19,
      "src": ""
    },
    "Disguise": {
      "t": 14,
      "src": ""
    },
    "Juggling": {
      "t": 18,
      "src": "Kit"
    },
    "Tumbling": {
      "t": 19,
      "src": ""
    },
    "Reading / Writing": {
      "t": 17,
      "src": "Kit"
    },
    "Local History": {
      "t": 15,
      "src": "Kit"
    },
    "Musical Instrument": {
      "t": 18,
      "src": "Class"
    },
    "Intimidation": {
      "t": 15,
      "src": ""
    }
  }
});
Object.assign(THIEF, {
  "Jaque": {
    "Pick Pockets": 20,
    "Open Locks": 55,
    "Find/Remove Traps": 10,
    "Move Silently": 50,
    "Hide in Shadows": 60,
    "Detect Noise": 25,
    "Climb Walls": 55
  }
});
Object.assign(SAVES, {
  "Jaque": {
    "base": {
      "PPD": 12,
      "RSW": 12,
      "PP": 11,
      "BW": 15,
      "Spell": 13
    },
    "mods": {},
    "note": "Elf: 90% resistance to sleep and charm"
  }
});
Object.assign(DAMAGE, {
  "Jaque|Superior Dagger": {"sm":"1d4+3","l":"1d3+3"},
  "Jaque|Leprechaun Dagger": {"sm":"1d4+2","l":"1d3+2"},
  "Jaque|Wave Dagger": {"sm":"1d4+2","l":"1d3+2"},
  "Jaque|Dagger x6, thrown": {"sm":"1d4+2","l":"1d3+2"},
  "Jaque|Trick Throw": {"sm":"1d4+2","l":"1d3+2"},
  "Jaque|Off-hand Dagger x6": {"sm":"1d4+2","l":"1d3+2"},
  "Jaque|Superior Dagger (2nd; melee alt. rounds)": {"sm":"1d4+3","l":"1d3+3"},
  "Jaque|Superior Dagger (3rd; thrown)": {"sm":"1d4+3","l":"1d3+3"}
});
Object.assign(CRIT_TYPES, {
  "Superior Dagger": "P",
  "Leprechaun Dagger": "P",
  "Wave Dagger": "P",
  "Dagger x6, thrown": "P",
  "Trick Throw": "P",
  "Off-hand Dagger x6": "P",
  "Superior Dagger (2nd; melee alt. rounds)": "P",
  "Superior Dagger (3rd; thrown)": "P"
});
Object.assign(WEAPON_MATERIAL, {
  "Superior Dagger": {"m":"metal"},
  "Leprechaun Dagger": {"m":"metal"},
  "Wave Dagger": {"m":"metal"},
  "Dagger x6, thrown": {"m":"metal"},
  "Trick Throw": {"m":"metal"},
  "Off-hand Dagger x6": {"m":"metal"},
  "Superior Dagger (2nd; melee alt. rounds)": {"m":"metal"},
  "Superior Dagger (3rd; thrown)": {"m":"metal"}
});
/* NEEDS REVIEW
   Jaque:
     - Leprechaun Dagger: Weapon has unidentified properties
     - Intimidation: Adjustment "*" isn't a number; target uses the bare ability score
*/
