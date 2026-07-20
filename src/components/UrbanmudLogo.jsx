import React from 'react';

export default function UrbanmudLogo({ size = 40, className = '' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 215"
      width={size}
      height={size}
      className={className}
    >
      <defs>
        <clipPath id="um-cl">
          <polygon points="100,8 15,42 15,130 45,172 100,208"/>
        </clipPath>
        <clipPath id="um-cr">
          <polygon points="100,8 185,42 185,130 155,172 100,208"/>
        </clipPath>
        <clipPath id="um-full">
          <polygon points="100,8 185,42 185,130 155,172 100,208 45,172 15,130 15,42"/>
        </clipPath>
      </defs>
      {/* Left – brown bricks */}
      <g clipPath="url(#um-cl)">
        <rect width="100" height="215" fill="#7B4A2A"/>
        <rect x="15" y="44" width="28" height="13" rx="1" fill="#8B5433"/>
        <rect x="45" y="44" width="28" height="13" rx="1" fill="#8B5433"/>
        <rect x="75" y="44" width="25" height="13" rx="1" fill="#8B5433"/>
        <rect x="15" y="59" width="14" height="13" rx="1" fill="#9A5E3C"/>
        <rect x="31" y="59" width="28" height="13" rx="1" fill="#9A5E3C"/>
        <rect x="61" y="59" width="28" height="13" rx="1" fill="#9A5E3C"/>
        <rect x="15" y="74" width="28" height="13" rx="1" fill="#8B5433"/>
        <rect x="45" y="74" width="28" height="13" rx="1" fill="#8B5433"/>
        <rect x="75" y="74" width="25" height="13" rx="1" fill="#8B5433"/>
        <rect x="15" y="89" width="14" height="13" rx="1" fill="#9A5E3C"/>
        <rect x="31" y="89" width="28" height="13" rx="1" fill="#9A5E3C"/>
        <rect x="61" y="89" width="28" height="13" rx="1" fill="#9A5E3C"/>
        <rect x="15" y="104" width="28" height="13" rx="1" fill="#8B5433"/>
        <rect x="45" y="104" width="28" height="13" rx="1" fill="#8B5433"/>
        <rect x="15" y="119" width="14" height="13" rx="1" fill="#9A5E3C"/>
        <rect x="31" y="119" width="28" height="13" rx="1" fill="#9A5E3C"/>
        <rect x="22" y="134" width="25" height="13" rx="1" fill="#8B5433"/>
        <rect x="49" y="134" width="28" height="13" rx="1" fill="#8B5433"/>
        <rect x="38" y="156" width="20" height="13" rx="1" fill="#8B5433"/>
        <rect x="60" y="156" width="20" height="13" rx="1" fill="#8B5433"/>
      </g>
      {/* Right – dark charcoal bricks */}
      <g clipPath="url(#um-cr)">
        <rect x="100" width="100" height="215" fill="#1E1E1E"/>
        <rect x="100" y="44" width="28" height="13" rx="1" fill="#2A2A2A"/>
        <rect x="130" y="44" width="28" height="13" rx="1" fill="#2A2A2A"/>
        <rect x="160" y="44" width="25" height="13" rx="1" fill="#2A2A2A"/>
        <rect x="100" y="59" width="14" height="13" rx="1" fill="#353535"/>
        <rect x="116" y="59" width="28" height="13" rx="1" fill="#353535"/>
        <rect x="146" y="59" width="28" height="13" rx="1" fill="#353535"/>
        <rect x="100" y="74" width="28" height="13" rx="1" fill="#2A2A2A"/>
        <rect x="130" y="74" width="28" height="13" rx="1" fill="#2A2A2A"/>
        <rect x="160" y="74" width="25" height="13" rx="1" fill="#2A2A2A"/>
        <rect x="100" y="89" width="14" height="13" rx="1" fill="#353535"/>
        <rect x="116" y="89" width="28" height="13" rx="1" fill="#353535"/>
        <rect x="146" y="89" width="28" height="13" rx="1" fill="#353535"/>
        <rect x="100" y="104" width="28" height="13" rx="1" fill="#2A2A2A"/>
        <rect x="130" y="104" width="28" height="13" rx="1" fill="#2A2A2A"/>
        <rect x="100" y="119" width="14" height="13" rx="1" fill="#353535"/>
        <rect x="116" y="119" width="28" height="13" rx="1" fill="#353535"/>
        <rect x="100" y="134" width="25" height="13" rx="1" fill="#2A2A2A"/>
        <rect x="127" y="134" width="28" height="13" rx="1" fill="#2A2A2A"/>
        <rect x="100" y="156" width="20" height="13" rx="1" fill="#2A2A2A"/>
        <rect x="122" y="156" width="20" height="13" rx="1" fill="#2A2A2A"/>
      </g>
      {/* City skyline */}
      <g clipPath="url(#um-full)" fill="#F5EDD8">
        <rect x="22" y="54" width="156" height="4"/>
        <rect x="88"  y="10" width="24" height="48"/>
        <rect x="77"  y="20" width="9"  height="38"/>
        <rect x="114" y="20" width="9"  height="38"/>
        <rect x="63"  y="27" width="12" height="31"/>
        <rect x="125" y="26" width="12" height="32"/>
        <rect x="48"  y="33" width="13" height="25"/>
        <rect x="139" y="32" width="13" height="26"/>
        <rect x="35"  y="39" width="11" height="19"/>
        <rect x="154" y="38" width="11" height="20"/>
      </g>
      {/* Green leaf */}
      <g clipPath="url(#um-full)">
        <rect x="98.5" y="152" width="3" height="28" fill="#1B5E20"/>
        <path d="M100,156 C84,142 66,151 75,165 C80,173 94,168 100,156 Z" fill="#4CAF50"/>
        <path d="M100,156 C116,142 134,151 125,165 C120,173 106,168 100,156 Z" fill="#388E3C"/>
      </g>
      {/* Outline */}
      <polygon points="100,8 185,42 185,130 155,172 100,208 45,172 15,130 15,42"
        fill="none" stroke="#111" strokeWidth="2.5" opacity="0.2"/>
    </svg>
  );
}
