import { createContext, useContext } from 'react'

// Brand colors — imported by all NFT pages
export const C = {
  teal:    '#6ce5c6',
  tealDark:'#3db99a',
  black:   '#020202',
  dark:    '#1f1f1f',
  pink:    '#ec6daa',
  lavender:'#9999e9',
  gray:    '#6a646a',
  bg:      '#f6f7f9',
  card:    '#ffffff',
  border:  '#e8e8ec',
  border2: '#d0d0d8',
}

export const NFTCtx = createContext({})
export const useNFT = () => useContext(NFTCtx)
