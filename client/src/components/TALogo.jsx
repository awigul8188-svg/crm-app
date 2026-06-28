import onDark from '../assets/ta-logo-on-dark.png'   // white-top mark — for dark backgrounds
import onLight from '../assets/ta-logo-on-light.png' // black-top mark — for light backgrounds

// Tech Atlantix logo mark. `size` is the height in px; width keeps the aspect ratio.
// Pass `light` when rendering on a light/white surface.
export default function TALogo({ size = 36, light = false }) {
  return <img src={light ? onLight : onDark} alt="Tech Atlantix" style={{ height: size, width: 'auto', display: 'block' }} />
}
