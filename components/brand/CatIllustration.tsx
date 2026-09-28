import type { SVGProps } from 'react';
import { CatHead } from './LogoMark';

/** Chat tigré assis, dans le style des illustrations produits. */
export function CatIllustration(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 300 410" aria-hidden="true" focusable="false" {...props}>
      <ellipse cx="160" cy="398" rx="126" ry="10" fill="#3b281c" opacity=".12" />
      <path d="M236 382c56-4 64-62 34-94" stroke="#6e4a33" strokeWidth={26} strokeLinecap="round" fill="none" />
      <path d="M268 352l15-7M282 322l15-1" stroke="#2a1c13" strokeWidth={8} strokeLinecap="round" />
      <path d="M88 170c-38 60-48 160-26 222h176c22-62 12-162-26-222Z" fill="#6e4a33" />
      <g stroke="#2a1c13" strokeWidth={9} strokeLinecap="round" fill="none">
        <path d="M60 268q16 3 29-7M54 310q18 4 32-6M240 268q-16 3-29-7M246 310q-18 4-32-6" />
      </g>
      <path d="M150 190c46 15 50 110 34 202h-68c-16-92-12-187 34-202Z" fill="#faf5ec" />
      <rect x="100" y="298" width="44" height="96" rx="22" fill="#6e4a33" />
      <rect x="156" y="298" width="44" height="96" rx="22" fill="#6e4a33" />
      <g stroke="#2a1c13" strokeWidth={7} strokeLinecap="round">
        <path d="M104 328h14M104 350h12M196 328h-14M196 350h-12" />
      </g>
      <ellipse cx="122" cy="391" rx="27" ry="12" fill="#faf5ec" />
      <ellipse cx="178" cy="391" rx="27" ry="12" fill="#faf5ec" />
      <g transform="translate(47.6 -2) scale(3.2)">
        <CatHead />
      </g>
    </svg>
  );
}
