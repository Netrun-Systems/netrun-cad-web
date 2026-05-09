import { registerIcons } from '../diagram-icons';
import { AWS_ICONS } from './aws';
import { AZURE_ICONS } from './azure';
import { GCP_ICONS } from './gcp';

let bootstrapped = false;

/** Register all bundled icon glyphs. Idempotent. Called once at app boot. */
export function bootstrapIcons(): void {
  if (bootstrapped) return;
  registerIcons(AWS_ICONS);
  registerIcons(AZURE_ICONS);
  registerIcons(GCP_ICONS);
  bootstrapped = true;
}

export { AWS_ICONS, AZURE_ICONS, GCP_ICONS };
