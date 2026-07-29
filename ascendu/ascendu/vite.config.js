import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const ENHANCEMENT_PRICING_REPLACEMENTS = [
  ['25% / 50% / 100%', '15% / 30% / 60%'],
  ['fully maxing a tree costs about as much as buying it once more', 'fully maxing a tree costs just over the skin price instead of nearly twice'],
  ['(100-coin base → 20/50/100)', '(100-coin base → 20/30/60)'],
  ['const mult = [0.25, 0.5, 1.0][tier-1] || 0;', 'const mult = [0.15, 0.3, 0.6][tier-1] || 0;'],
]

const WEEKLY_REWARD_REPLACEMENTS = [
  [
    '{ place:"2nd", medal:"🥈", type:"coins", coins:WEEKLY_PODIUM_REWARDS[1] },',
    '{ place:"2nd", medal:"🥈", type:"decoration", coins:0 },',
  ],
  [
    '{ place:"3rd", medal:"🥉", type:"coins", coins:WEEKLY_PODIUM_REWARDS[2] },',
    '{ place:"3rd", medal:"🥉", type:"coins", coins:100 },',
  ],
  [
    'return available[stableRewardHash(`${weekKey}|${username}`)%available.length];\n};',
    [
      'return available[stableRewardHash(`${weekKey}|${username}`)%available.length];',
      '};',
      'const pickWeeklyDecoration = (weekKey,username,ownedDecorations=[]) => {',
      '  const owned=new Set(Array.isArray(ownedDecorations)?ownedDecorations:[]);',
      '  const available=DECORATIONS.filter(d=>!owned.has(d.id));',
      '  if(!available.length) return null;',
      '  return available[stableRewardHash(`${weekKey}|${username}|decoration`)%available.length];',
      '};',
    ].join('\n'),
  ],
  [
    'const ownedSkins = Array.isArray(prefs.ownedSkins) && prefs.ownedSkins.length ? prefs.ownedSkins : ["default"];',
    [
      'const ownedSkins = Array.isArray(prefs.ownedSkins) && prefs.ownedSkins.length ? prefs.ownedSkins : ["default"];',
      '      const ownedDecorations = Array.isArray(prefs.decorations) ? prefs.decorations : [];',
    ].join('\n'),
  ],
  [
    'existing===true || existing.rewardType==="coins" || existing.rewardType==="skin" ||',
    'existing===true || existing.rewardType==="coins" || existing.rewardType==="skin" || existing.rewardType==="decoration" ||',
  ],
  [
    'Number(existing.reward)>0 || !!existing.skinId',
    'Number(existing.reward)>0 || !!existing.skinId || !!existing.decorationId',
  ],
  [
    'coinBalance:typeof prefs.coins==="number"?prefs.coins:0,\n        ownedSkins,',
    'coinBalance:typeof prefs.coins==="number"?prefs.coins:0,\n        ownedSkins,\n        decorations:ownedDecorations,',
  ],
  [
    'let skinFallback = false;',
    'let skinFallback = false;\n      let decoration = null;\n      let decorationFallback = false;',
  ],
  [
    [
      '      if(rewardMode==="skin" && rank===0){',
      '        skin = pickWeeklySkin(weekKey,username,ownedSkins);',
      '        if(skin) reward=0;',
      '        else skinFallback=true;',
      '      }',
      '',
      '      const claimData = {',
    ].join('\n'),
    [
      '      if(rewardMode==="skin" && rank===0){',
      '        skin = pickWeeklySkin(weekKey,username,ownedSkins);',
      '        if(skin) reward=0;',
      '        else skinFallback=true;',
      '      }',
      '',
      '      // Second place always receives one deterministic random unowned',
      '      // garden decoration. If every decoration is owned, keep the former',
      '      // 150-coin second-place value as a fair fallback.',
      '      if(rank===1){',
      '        decoration = pickWeeklyDecoration(weekKey,username,ownedDecorations);',
      '        if(decoration) reward=0;',
      '        else decorationFallback=true;',
      '      }',
      '',
      '      const claimData = {',
    ].join('\n'),
  ],
  [
    'rewardType:skin?"skin":reward>0?"coins":"none",',
    'rewardType:skin?"skin":decoration?"decoration":reward>0?"coins":"none",',
  ],
  [
    'skinId:skin?.id||null, skinName:skin?.name||null,\n        skinFallback,',
    'skinId:skin?.id||null, skinName:skin?.name||null,\n        decorationId:decoration?.id||null, decorationName:decoration?.name||null,\n        skinFallback, decorationFallback,',
  ],
  [
    'tx.set(prefsRef, { ownedSkins:nextOwned }, { merge:true });\n      } else if(reward>0){',
    [
      'tx.set(prefsRef, { ownedSkins:nextOwned }, { merge:true });',
      '      } else if(decoration){',
      '        const nextDecorations=[...new Set([...ownedDecorations,decoration.id])];',
      '        tx.set(prefsRef, { decorations:nextDecorations }, { merge:true });',
      '      } else if(reward>0){',
    ].join('\n'),
  ],
  [
    'skinId:skin?.id||null, skinName:skin?.name||null, skinFallback,',
    'skinId:skin?.id||null, skinName:skin?.name||null,\n        decorationId:decoration?.id||null, decorationName:decoration?.name||null,\n        skinFallback, decorationFallback,',
  ],
  [
    'coinBalance:skin ? (typeof prefs.coins==="number"?prefs.coins:0) : (typeof prefs.coins==="number"?prefs.coins:0)+reward,',
    'coinBalance:(skin||decoration) ? (typeof prefs.coins==="number"?prefs.coins:0) : (typeof prefs.coins==="number"?prefs.coins:0)+reward,',
  ],
  [
    'ownedSkins:skin ? [...new Set([...ownedSkins,skin.id])] : ownedSkins,',
    'ownedSkins:skin ? [...new Set([...ownedSkins,skin.id])] : ownedSkins,\n        decorations:decoration ? [...new Set([...ownedDecorations,decoration.id])] : ownedDecorations,',
  ],
  [
    'if(Array.isArray(r.ownedSkins)){\n          setOwnedSkins(r.ownedSkins);lsSet("studygrove_owned_skins",r.ownedSkins);\n        }',
    [
      'if(Array.isArray(r.ownedSkins)){',
      '          setOwnedSkins(r.ownedSkins);lsSet("studygrove_owned_skins",r.ownedSkins);',
      '        }',
      '        if(Array.isArray(r.decorations)){',
      '          setDecorations(r.decorations);lsSet(LS_DECOR,r.decorations);',
      '        }',
    ].join('\n'),
  ],
  [
    'if(!r.alreadyClaimed && (r.reward>0 || r.skinId)){',
    'if(!r.alreadyClaimed && (r.reward>0 || r.skinId || r.decorationId)){',
  ],
  [
    [
      '          if(r.skinId){',
      '            showToast(`🥇 Last week\'s #1 prize: ${r.skinName||"Mystery"} skin unlocked`);',
      '          } else {',
      '            showToast(`${r.rank===1?"🥇":r.rank===2?"🥈":"🥉"} Last week\'s #${r.rank}: +${r.reward} coins${r.skinFallback?" (all skins owned)":""}`);',
      '          }',
    ].join('\n'),
    [
      '          if(r.skinId){',
      '            showToast(`🥇 Last week\'s #1 prize: ${r.skinName||"Mystery"} skin unlocked`);',
      '          } else if(r.decorationId){',
      '            showToast(`🥈 Last week\'s #2 prize: ${r.decorationName||"Mystery"} decoration unlocked`);',
      '          } else {',
      '            const fallbackNote=r.skinFallback?" (all skins owned)":r.decorationFallback?" (all decorations owned)":"";',
      '            showToast(`${r.rank===1?"🥇":r.rank===2?"🥈":"🥉"} Last week\'s #${r.rank}: +${r.reward} coins${fallbackNote}`);',
      '          }',
    ].join('\n'),
  ],
  [
    'style={{...S.rewardPrize,...(prize.type==="skin"?S.rewardPrizeSkin:{})}}',
    'style={{...S.rewardPrize,...(["skin","decoration"].includes(prize.type)?S.rewardPrizeSkin:{})}}',
  ],
  [
    'style={prize.type==="skin"?S.rewardSkin:S.rewardCoins}',
    'style={["skin","decoration"].includes(prize.type)?S.rewardSkin:S.rewardCoins}',
  ],
  [
    '{prize.type==="skin"?"🎁 Random skin":`+${prize.coins} 🪙`}',
    '{prize.type==="skin"?"🎁 Random skin":prize.type==="decoration"?"🎁 Random decor":`+${prize.coins} 🪙`}',
  ],
  [
    '? "First place receives a random unowned shop skin. If every skin is owned, the prize becomes 300 coins."\n            : "This week all top-three places receive coins."',
    '? "First place receives a random unowned shop skin, second receives a random unowned decoration, and third receives 100 coins. Full collections fall back to coins."\n            : "First place receives 300 coins, second receives a random unowned decoration, and third receives 100 coins. If every decoration is owned, second receives 150 coins."',
  ],
  [
    'Group boards do not award coins or skins.',
    'Group boards do not award coins, skins or decorations.',
  ],
]

function applySourceReplacements(code, replacements, groupName) {
  let nextCode = code
  for (const [current, replacement] of replacements) {
    if (!nextCode.includes(current)) {
      throw new Error(`StudyGrove ${groupName} source changed: missing ${current}`)
    }
    nextCode = nextCode.replace(current, replacement)
  }
  return nextCode
}

function studyGroveSourcePatches() {
  return {
    name: 'studygrove-source-patches',
    enforce: 'pre',
    transform(code, id) {
      if (!/[\\/]src[\\/]App\.jsx$/.test(id)) return null

      // Git may materialise App.jsx with CRLF on Windows. The guarded source
      // patches intentionally use LF snippets, so normalise only the in-memory
      // transform input rather than rewriting the checked-in source file.
      let nextCode = code.replace(/\r\n/g, '\n')
      nextCode = applySourceReplacements(nextCode, ENHANCEMENT_PRICING_REPLACEMENTS, 'enhancement pricing')
      nextCode = applySourceReplacements(nextCode, WEEKLY_REWARD_REPLACEMENTS, 'weekly rewards')
      return { code: nextCode, map: null }
    },
  }
}

export default defineConfig({
  plugins: [studyGroveSourcePatches(), react()],
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: ['firebase/app', 'firebase/firestore'],
          react: ['react', 'react-dom'],
        }
      }
    }
  }
})
