'use client';

import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { checkAddress } from '../lib/address';

/** Props of {@link AddressForm}. */
export interface AddressFormProps {
  /** Called with a valid-looking public address when the user submits. */
  onSubmit: (address: string) => void;
  /** True while a request is running. */
  busy: boolean;
}

/**
 * One field for a public Stellar address, with inline validation. Anything shaped like a secret key
 * is cleared from the field at once, never submitted, never stored and never shown back.
 */
export function AddressForm({ onSubmit, busy }: AddressFormProps) {
  const id = useId();
  const [value, setValue] = useState('');
  const [secretWarning, setSecretWarning] = useState(false);
  const [showInvalid, setShowInvalid] = useState(false);

  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const check = checkAddress(value);
  const invalid = showInvalid && check.kind !== 'ok';

  function handleChange(text: string): void {
    if (checkAddress(text).kind === 'secret') {
      setValue('');
      setSecretWarning(true);
      return;
    }
    setSecretWarning(false);
    setValue(text);
  }

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();
    if (check.kind === 'ok') {
      setShowInvalid(false);
      onSubmit(check.address);
    } else {
      setShowInvalid(true);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="address-form">
      <label htmlFor={id}>Stellar public address</label>
      <p id={hintId} className="muted">
        Starts with G. Only public addresses are needed. Never enter a secret key or seed phrase.
      </p>
      <div className="row">
        <input
          id={id}
          name="address"
          type="text"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          aria-describedby={`${hintId}${invalid || secretWarning ? ` ${errorId}` : ''}`}
          aria-invalid={invalid || secretWarning}
          disabled={busy}
        />
        <button type="submit" disabled={busy}>
          {busy ? 'Loading…' : 'Load history'}
        </button>
      </div>
      <div id={errorId} role="alert" className="error-text">
        {secretWarning
          ? 'That looked like a secret key, so it was removed and not sent anywhere. Never share a secret key; use the public address that starts with G.'
          : invalid
            ? check.kind === 'empty'
              ? 'Enter an address.'
              : 'This does not look like a Stellar public address (G followed by 55 letters and digits).'
            : ''}
      </div>
    </form>
  );
}
