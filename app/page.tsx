import { Workbench } from '../components/Workbench';
import { Disclaimer } from './disclaimer';

/** Home page: the whole flow. */
export default function Home() {
  return (
    <main>
      <h1>Stellar Ledger Tax</h1>
      <p>
        Turn the public history of a Stellar address into classified events and accounting reports.
        Read-only: this app never asks for keys and never sends a transaction.
      </p>
      <Disclaimer />
      <Workbench />
      <footer className="muted">
        <p>
          Classification can be wrong and history may be incomplete (the server says which range it
          covers). Prices and labels are yours; labels are kept only in this browser.
        </p>
      </footer>
    </main>
  );
}
