import { mount } from 'svelte';
import { registerSW } from 'virtual:pwa-register';
import App from './App.svelte';
import './app.css';

// Installs the service worker so the game works offline after the first visit.
registerSW({ immediate: true });

mount(App, { target: document.getElementById('app') as HTMLElement });
