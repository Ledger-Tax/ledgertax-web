import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Vitest has no globals here, so Testing Library's automatic cleanup is not registered.
afterEach(() => cleanup());
