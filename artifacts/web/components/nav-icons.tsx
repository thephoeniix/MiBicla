import type { CSSProperties } from "react";
import fidelityAsset from "../../icons/fidelity.svg";
import homeAsset from "../../icons/home-angle-svgrepo-com.svg";
import tallerAsset from "../../icons/taller.svg";

// Iconos de navegación y tarjetas, adaptados de
// artifacts/icons/*.svg. El color original de cada SVG se reemplaza por
// currentColor para heredar el color de texto normal/activo ya definido en
// style.css (p. ej. .customer-bottom-nav [aria-current="page"] { color: ... }),
// igual que ya hacen WhatsappIcon/InstagramIcon en PublicPages.tsx.

function AssetIcon({ src }: { src: string }) {
  return (
    <span
      className="nav-asset-icon"
      style={{ "--nav-icon": `url("${src}")` } as CSSProperties}
      aria-hidden="true"
    />
  );
}

export function HomeAssetIcon() {
  return <AssetIcon src={homeAsset} />;
}

export function FidelityAssetIcon() {
  return <AssetIcon src={fidelityAsset} />;
}

export function TallerAssetIcon() {
  return <AssetIcon src={tallerAsset} />;
}

export function MoreIcon() {
  return (
    <svg viewBox="0 -0.5 25 25" fill="none" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8.5 12C8.5 13.1046 7.60457 14 6.5 14C5.39543 14 4.5 13.1046 4.5 12C4.5 10.8954 5.39543 10 6.5 10C7.03043 10 7.53914 10.2107 7.91421 10.5858C8.28929 10.9609 8.5 11.4696 8.5 12Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M14.5 12C14.5 13.1046 13.6046 14 12.5 14C11.3954 14 10.5 13.1046 10.5 12C10.5 10.8954 11.3954 10 12.5 10C13.6046 10 14.5 10.8954 14.5 12Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M20.5 12C20.5 13.1046 19.6046 14 18.5 14C17.3954 14 16.5 13.1046 16.5 12C16.5 10.8954 17.3954 10 18.5 10C19.6046 10 20.5 10.8954 20.5 12Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FidelityIcon() {
  return (
    <svg viewBox="0 0 512 512" fill="currentColor" aria-hidden="true">
      <path d="M480.925,279.697c-11.272-12.285-32.272-9.672-46.316,0.716c-12.834,10.695-100.573,68.357-100.573,68.357
        H227.397l-0.336,0.168c-5.617-0.186-10.006-4.902-9.84-10.509c0.205-5.618,4.93-10.017,10.51-9.822l-0.335-0.195
        c19.065,0,78.569,0,78.569,0c15.773,0,28.571-12.779,28.571-28.542c0-15.792-12.798-28.58-28.571-28.58
        c-14.285,0-42.838,0-114.246,0c-71.427,0-94.045,29.771-119.044,54.751l-45.348,39.62c-2.958,2.567-4.65,6.259-4.65,10.184V507.51
        c0,1.739,1.042,3.348,2.641,4.083c1.6,0.726,3.479,0.474,4.818-0.688l87.646-75.147c3.088-2.623,7.217-3.739,11.198-3.023
        l136.604,24.832c9.523,1.73,19.326-0.455,27.268-6.044c0,0,174.326-121.23,187.216-131.954
        C492.327,308.315,492.197,291.983,480.925,279.697z" />
      <path d="M216.627,218.333c21.521,14.742,48.604,25.548,48.604,25.548c2.492,0.81,6.343,1.516,7.682,1.516
        c1.321,0,5.171-0.706,7.664-1.516c0,0,27.064-10.806,48.603-25.548c32.774-22.34,85.935-66.191,85.935-128.01
        c0-62.703-35.472-91.116-74.495-90.306c-29.761,0.539-47.339,18.126-59.132,35.462c-2.158,3.218-5.376,5.273-8.575,5.357
        c-3.218-0.084-6.436-2.139-8.575-5.357c-11.793-17.336-29.389-34.923-59.15-35.462c-39.043-0.81-74.477,27.603-74.477,90.306
        C130.711,152.142,183.852,195.994,216.627,218.333z M187.368,39.282c2.994-3.673,6.733-6.788,11.011-9.384
        c4.223-2.548,9.71-1.2,12.258,3.023c2.568,4.222,1.209,9.719-3.014,12.258c-2.808,1.711-4.873,3.497-6.399,5.384
        c-3.106,3.832-8.742,4.399-12.574,1.284C184.838,48.732,184.262,43.115,187.368,39.282z M166.442,96.192
        c0-5.97,0.614-11.513,1.934-16.61c1.246-4.781,6.139-7.636,10.901-6.38c4.78,1.237,7.625,6.12,6.398,10.89
        c-0.874,3.311-1.376,7.347-1.376,12.1c0,4.706,0.484,10.119,1.506,16.183c1.637,9.71,5.767,18.731,11.811,27.203
        c2.865,4.008,1.935,9.588-2.083,12.453c-4.036,2.864-9.598,1.934-12.462-2.083c-7.31-10.203-12.723-21.791-14.881-34.597
        C167.037,108.488,166.442,102.126,166.442,96.192z" />
    </svg>
  );
}

export function DepositsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M22 12C22 8.22876 22 6.34315 20.8284 5.17157C19.6569 4 17.7712 4 14 4H10C6.22876 4 4.34315 4 3.17157 5.17157C2 6.34315 2 8.22876 2 12C2 15.7712 2 17.6569 3.17157 18.8284C4.34315 20 6.22876 20 10 20H14C17.7712 20 19.6569 20 20.8284 18.8284C21.4816 18.1752 21.7706 17.3001 21.8985 16"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d="M10 16H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M14 16H12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M2 10L7 10M22 10L11 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function ProductsIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16l-1 14H5L4 7Z" /><path d="M8 9V6a4 4 0 0 1 8 0v3" /></svg>;
}

export function EventsIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4m10-4v4M3 10h18" /><path d="m8 15 2 2 5-5" /></svg>;
}

export function OrdersIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 3h10v3H7z" /><path d="M6 5H5a2 2 0 0 0-2 2v13h18V7a2 2 0 0 0-2-2h-1" /><path d="M7 11h10M7 15h7" /></svg>;
}

export function BicyclesIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="6" cy="17" r="4" /><circle cx="18" cy="17" r="4" /><path d="m6 17 4-8 4 8H6m4-8h5l3 8M8 6h4" /></svg>;
}

export function RequestsIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>;
}

export function SettingsIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" /></svg>;
}

export function AdminHomeIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></svg>;
}

export function LoyaltyAdminIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 21s8-4.6 8-11a4.5 4.5 0 0 0-8-2.8A4.5 4.5 0 0 0 4 10c0 6.4 8 11 8 11Z" /><path d="M9 12h6M12 9v6" /></svg>;
}

export function WorkshopAdminIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14.7 6.3a4 4 0 0 0-5-5L12 3.6 9.6 6 7.3 3.7a4 4 0 0 0 5 5L20 16.4a2.5 2.5 0 0 1-3.6 3.6l-7.7-7.7" /><path d="m5.5 13.5-3 3a2.1 2.1 0 0 0 3 3l3-3" /></svg>;
}

export function TallerIcon() {
  return (
    <svg viewBox="0 0 64 64" fill="currentColor" aria-hidden="true">
      <path d="M14.73,42.9a5,5,0,0,0,1.35.94,30.35,30.35,0,0,0,2.12,9.71,10.2,10.2,0,0,1,.8,3.91V61a3,3,0,0,0,3,3H34a3,3,0,0,0,3-3,7.53,7.53,0,0,1,1.66-4.71l6.53-8.14c.11-.12.21-.25.31-.37s.2-.21.29-.33.19-.27.28-.41l.25-.36c.09-.15.15-.3.23-.44s.14-.26.2-.39.13-.32.19-.48l.15-.39c0-.17.09-.34.13-.52s.07-.25.1-.38,0-.37.07-.55,0-.25.06-.38,0-.42,0-.63,0-.2,0-.31a7.47,7.47,0,0,0-.09-.94h0l-.08-.48-1-6.48a8,8,0,0,0-.6-2l0,0a.67.67,0,0,0-.06-.12,8,8,0,0,0-4.45-4.08L38.05,27l3.47-3.4L45,20a1,1,0,0,1,.9-.26,10,10,0,0,0,11.64-6.89,9.91,9.91,0,0,0,.37-4,2,2,0,0,0-3.42-1.17l-2.78,2.84a1,1,0,0,1-1.42,0L47.49,7.73A1,1,0,0,1,47.2,7a1,1,0,0,1,.3-.72l2.79-2.84a2,2,0,0,0,.47-2.08A2,2,0,0,0,49.11.06a10.16,10.16,0,0,0-4,.38,10,10,0,0,0-6.84,11.63A1,1,0,0,1,38,13L32.18,18.7a4,4,0,0,0-7.09,1.55A4,4,0,0,0,20,24.1a3.85,3.85,0,0,0,.25,1.39l-.24,0a4,4,0,0,0-2.92,5.79,4,4,0,0,0-2.66,4.89,5,5,0,0,0,.3,6.7Zm.83-4.83.18.13a2.42,2.42,0,0,0,.31.25,4.14,4.14,0,0,0,.62.35l4,1.72a3.58,3.58,0,0,0,.55.19l-.81.8a3.12,3.12,0,0,1-.41.33l-.14.09-.33.17-.18.08-.38.11-.29,0-.16,0a3.22,3.22,0,0,1-1.14-.14h0a2.91,2.91,0,0,1-1.17-.71,3,3,0,0,1-.59-3.42ZM42.44,31.2a6,6,0,0,1,1.82,3.43l1.13,7a5.69,5.69,0,0,1,.07.71,6.07,6.07,0,0,1-1.73,4.48l-.07.07L37.1,55A9.5,9.5,0,0,0,35,61a1,1,0,0,1-1,1H22a1,1,0,0,1-1-1V57.46a12.1,12.1,0,0,0-1-4.68,28.18,28.18,0,0,1-1.94-8.43h.17a4.34,4.34,0,0,0,.62-.06,2.11,2.11,0,0,0,.25,0,4.26,4.26,0,0,0,.7-.19l.25-.07a5.56,5.56,0,0,0,.73-.37l.16-.08a5.2,5.2,0,0,0,.79-.63l5.61-5.51a3.75,3.75,0,0,0,1.7-1l.06-.05a4.91,4.91,0,0,0,.41-.48,3.81,3.81,0,0,0,.66-1.5,4.13,4.13,0,0,0,.93-.09,6.84,6.84,0,0,0,2.56,1.58l2.38.91a1.51,1.51,0,0,1,1,1.24,1.55,1.55,0,0,1-1,1.62c-5.36,2-8.39,5.44-9,10.19A1,1,0,0,0,27.87,51H28a1,1,0,0,0,1-.87c.54-4,3.07-6.82,7.74-8.57A3.57,3.57,0,0,0,39,37.82,3.5,3.5,0,0,0,36.79,35L34.38,34a5,5,0,0,1-2.22-1.55,3.3,3.3,0,0,1-.34-.49c-.06-.09-.12-.18-.17-.27a4.41,4.41,0,0,1-.28-.58c-.05-.13-.1-.26-.14-.4s-.07-.25-.1-.37-.05-.3-.07-.45a2.58,2.58,0,0,1,0-.39.48.48,0,0,1,0-.12,3.37,3.37,0,0,1,0-.55,1.36,1.36,0,0,1,0-.2.78.78,0,0,1,0-.16,4.86,4.86,0,0,1,.19-.82,1,1,0,0,1,1.25-.63L40.42,30A6.15,6.15,0,0,1,42.44,31.2ZM39.37,14.38a3,3,0,0,0,.81-2.73A7.78,7.78,0,0,1,40.26,8a7.93,7.93,0,0,1,5.38-5.64,7.76,7.76,0,0,1,3.23-.3L46.08,4.9a3,3,0,0,0,0,4.25L48.91,12a3.08,3.08,0,0,0,4.25,0L56,9.11h0a8.12,8.12,0,0,1-.29,3.2A7.9,7.9,0,0,1,50,17.74a7.77,7.77,0,0,1-3.68.08,3,3,0,0,0-2.74.81l-7.1,7,0-.06a3.65,3.65,0,0,0-.35-.75h0L33.3,20.41Zm-11.44,5a2,2,0,0,1,2.76.62l.49.77h0l3,4.74-1-.37a2.94,2.94,0,0,0-2.29.15,2.61,2.61,0,0,0-.28.17l-3.55-3.95A2,2,0,0,1,27.93,19.4Zm-5.34,3.29a2,2,0,0,1,2.85,0l3.92,4.37c-.05.16-.09.32-.14.49a7,7,0,0,0,.42,4.63l-5.45-5.09-1.6-1.6a2,2,0,0,1,0-2.82ZM19,28.3a2,2,0,0,1,2.79-.45l1,.76,5.45,5.07v0a2,2,0,0,1-.37,1l0,0a1.79,1.79,0,0,1-.22.25l0,0a2,2,0,0,1-1,.48,2,2,0,0,1-1.08-.08l-5.41-3.8h0l-.75-.55A2,2,0,0,1,19,28.3Zm-2.59,6a2,2,0,0,1,1.84-1.2,2,2,0,0,1,.8.16l.08,0,5.06,3.55a2,2,0,0,1-.15.77A1.94,1.94,0,0,1,23,38.71a2,2,0,0,1-1.53,0l-4-1.73,0,0a1.77,1.77,0,0,1-.33-.19l0,0a2.17,2.17,0,0,1-.6-.75h0l-.06-.11A2,2,0,0,1,16.43,34.33Z" />
      <path d="M25.55,11.78a.51.51,0,0,0,.23.67l2,1a.54.54,0,0,0,.22.05.5.5,0,0,0,.22-.95l-2-1A.51.51,0,0,0,25.55,11.78Z" />
      <path d="M29,10.5a.47.47,0,0,0,.35-.15.48.48,0,0,0,0-.7l-2-2a.49.49,0,0,0-.7.7l2,2A.47.47,0,0,0,29,10.5Z" />
      <path d="M32.5,10V9a.5.5,0,0,0-1,0v1a.5.5,0,0,0,1,0Z" />
    </svg>
  );
}

export function ClientsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="8" r="4" />
      <path d="M2.5 21c.5-4.4 2.7-6.5 6.5-6.5s6 2.1 6.5 6.5" />
      <path d="M16 4.6a4 4 0 0 1 0 6.8M17 14.8c2.7.8 4.1 2.9 4.5 6.2" />
    </svg>
  );
}

export function AdministrativeUsersIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="3.5" /><path d="M2.5 20c.4-4 2.2-6 5.5-6s5.1 2 5.5 6" /><circle cx="17.5" cy="9" r="2.5" /><path d="M15.5 14.5c3.8-.7 5.8 1.1 6 5.5" /></svg>;
}
