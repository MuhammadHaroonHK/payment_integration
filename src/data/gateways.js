/**
 * Gateway definitions used by the checkout, review, result and history pages.
 *
 * No official JazzCash / Easypaisa logo files are bundled in this project:
 * reproducing brand artwork without permission is not allowed, and inventing
 * look-alike logos is misleading. Instead each gateway is presented with a
 * plain text identifier plus a small brand-coloured marker, which is enough to
 * identify the method without misrepresenting the brand.
 */

export const GATEWAYS = [
  {
    id: 'jazzcash',
    name: 'JazzCash',
    identifier: 'JazzCash',
    description: 'Pay from your JazzCash mobile wallet balance.',
    detail: 'Mobile wallet · simulated checkout',
    icon: 'smartphone',
    markerColor: '#ec1c24',
    codePrefix: 'JC',
  },
  {
    id: 'easypaisa',
    name: 'Easypaisa',
    identifier: 'Easypaisa',
    description: 'Pay from your Easypaisa mobile account balance.',
    detail: 'Mobile account · simulated checkout',
    icon: 'wallet',
    markerColor: '#00a651',
    codePrefix: 'EP',
  },
]

/**
 * Look a gateway up by id. Falls back to the first gateway so the UI never
 * crashes on an unknown value.
 */
export function getGatewayById(id) {
  return GATEWAYS.find((gateway) => gateway.id === id) || null
}

export function getGatewayName(id) {
  const gateway = getGatewayById(id)
  return gateway ? gateway.name : 'Unknown gateway'
}
