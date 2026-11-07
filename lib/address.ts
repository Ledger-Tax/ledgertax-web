/** Result of looking at what the user typed in the address field. */
export type AddressCheck =
  { kind: 'empty' } | { kind: 'ok'; address: string } | { kind: 'secret' } | { kind: 'invalid' };

/**
 * Looks at the text of the address field before anything is sent anywhere.
 *
 * A Stellar secret key is 56 characters starting with `S`; it is never sent, stored or shown back.
 * This is a quick shape check; the server validates the checksum.
 */
export function checkAddress(input: string): AddressCheck {
  const text = input.trim();
  if (text === '') return { kind: 'empty' };
  if (/^[Ss][A-Za-z2-7]{55}$/.test(text)) return { kind: 'secret' };
  if (/^G[A-Z2-7]{55}$/.test(text) || /^M[A-Z2-7]{68}$/.test(text))
    return { kind: 'ok', address: text };
  return { kind: 'invalid' };
}
