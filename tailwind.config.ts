import type { Config } from "tailwindcss";

const config: Config = {
    darkMode: ["class"],
    content: ["./app/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
  	extend: {
  		colors: {
  			// Déja brand tokens
  			deja: {
  				cream:      '#F5EFE0',
  				'warm-white': '#FAF7F2',
  				amber:      '#C8843A',
  				'amber-light': '#E4A95A',
  				'amber-glow': 'rgba(200,132,58,0.15)',
  				'dusty-rose': '#C4967A',
  				'brown-dark': '#2C1F14',
  				'brown-mid': '#3D2A18',
  				'brown-soft': '#8B6347',
  				sage:       '#7A8C6E',
  				charcoal:   '#141009',
  			},
  			// Legacy EasyPoly tokens (kept for dashboard compatibility)
  			ep: {
  				bg: '#08090E',
  				surface: '#0F1118',
  				card: '#151823',
  				'card-hover': '#1A1E2E',
  				border: '#1E2235',
  				'border-bright': '#2A3050'
  			},
  			text: {
  				primary: '#E8ECF4',
  				secondary: '#8B92A8',
  				muted: '#505672',
  				inverse: '#08090E'
  			},
  			accent: {
  				DEFAULT: '#C8843A',
  				bright: '#E4A95A',
  				dim: '#8B6347',
  				muted: 'rgba(200,132,58,0.15)',
  				glow: 'rgba(200,132,58,0.25)',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			conviction: {
  				high: '#7A8C6E',
  				'high-bg': 'rgba(122,140,110,0.12)',
  				medium: '#F0B000',
  				'medium-bg': 'rgba(240, 176, 0, 0.12)',
  				low: '#FF4060',
  				'low-bg': 'rgba(255, 64, 96, 0.12)'
  			},
  			profit: '#7A8C6E',
  			loss: '#FF4060',
  			tier: {
  				micro: '#A78BFA',
  				small: '#60A5FA',
  				mid: '#FBBF24',
  				whale: '#34D399'
  			},
  			style: {
  				degen: '#F472B6',
  				sniper: '#F97316',
  				grinder: '#818CF8',
  				whale: '#22D3EE'
  			},
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		fontFamily: {
  			display: [
  				'DM Serif Display',
  				'Georgia',
  				'serif'
  			],
  			heading: [
  				'Playfair Display',
  				'Georgia',
  				'serif'
  			],
  			body: [
  				'Jost',
  				'system-ui',
  				'sans-serif'
  			],
  			mono: [
  				'DM Mono',
  				'JetBrains Mono',
  				'monospace'
  			]
  		},
  		fontSize: {
  			'stat-xl': [
  				'3rem',
  				{
  					lineHeight: '1',
  					letterSpacing: '-0.03em',
  					fontWeight: '700'
  				}
  			],
  			'stat-lg': [
  				'2rem',
  				{
  					lineHeight: '1.1',
  					letterSpacing: '-0.02em',
  					fontWeight: '600'
  				}
  			],
  			'stat-md': [
  				'1.25rem',
  				{
  					lineHeight: '1.2',
  					letterSpacing: '-0.01em',
  					fontWeight: '600'
  				}
  			],
  			'stat-sm': [
  				'0.875rem',
  				{
  					lineHeight: '1.3',
  					letterSpacing: '0',
  					fontWeight: '500'
  				}
  			]
  		},
  		borderRadius: {
  			'xl': '12px',
  			'2xl': '16px',
  			'3xl': '20px',
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		backdropBlur: {
  			xs: '2px'
  		},
  		boxShadow: {
  			'glow': '0 0 30px rgba(200,132,58,0.15), 0 0 60px rgba(200,132,58,0.05)',
  			'glow-sm': '0 0 15px rgba(200,132,58,0.1)',
  			'glow-lg': '0 0 50px rgba(200,132,58,0.2), 0 0 100px rgba(200,132,58,0.08)',
  			'card': '0 4px 24px rgba(0, 0, 0, 0.3)',
  			'card-hover': '0 8px 40px rgba(0, 0, 0, 0.4), 0 0 30px rgba(200,132,58,0.06)',
  			'inner-glow': 'inset 0 1px 0 rgba(255,255,255,0.04)'
  		},
  		animation: {
  			'pulse-slow': 'pulse 3s ease-in-out infinite',
  			'fade-in': 'fadeIn 0.5s ease-out',
  			'slide-up': 'slideUp 0.4s ease-out',
  			'slide-in-right': 'slideInRight 0.3s ease-out',
  			'tick-up': 'tickUp 0.6s ease-out',
  			'tick-down': 'tickDown 0.6s ease-out',
  			'glow-pulse': 'glowPulse 2s ease-in-out infinite',
  			'shimmer': 'shimmer 2s linear infinite',
  			'live-dot': 'liveDot 1.5s ease-in-out infinite'
  		},
  		keyframes: {
  			fadeIn: {
  				'0%': {
  					opacity: '0'
  				},
  				'100%': {
  					opacity: '1'
  				}
  			},
  			slideUp: {
  				'0%': {
  					opacity: '0',
  					transform: 'translateY(12px)'
  				},
  				'100%': {
  					opacity: '1',
  					transform: 'translateY(0)'
  				}
  			},
  			slideInRight: {
  				'0%': {
  					opacity: '0',
  					transform: 'translateX(20px)'
  				},
  				'100%': {
  					opacity: '1',
  					transform: 'translateX(0)'
  				}
  			},
  			tickUp: {
  				'0%': {
  					color: 'inherit'
  				},
  				'50%': {
  					color: '#7A8C6E'
  				},
  				'100%': {
  					color: 'inherit'
  				}
  			},
  			tickDown: {
  				'0%': {
  					color: 'inherit'
  				},
  				'50%': {
  					color: '#FF4060'
  				},
  				'100%': {
  					color: 'inherit'
  				}
  			},
  			glowPulse: {
  				'0%, 100%': {
  					boxShadow: '0 0 15px rgba(200,132,58,0.1)'
  				},
  				'50%': {
  					boxShadow: '0 0 30px rgba(200,132,58,0.25)'
  				}
  			},
  			shimmer: {
  				'0%': {
  					backgroundPosition: '-200% 0'
  				},
  				'100%': {
  					backgroundPosition: '200% 0'
  				}
  			},
  			liveDot: {
  				'0%, 100%': {
  					opacity: '1',
  					transform: 'scale(1)'
  				},
  				'50%': {
  					opacity: '0.5',
  					transform: 'scale(0.8)'
  				}
  			}
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
