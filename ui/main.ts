import { createApp } from 'vue';
import { JsonToken } from './json';
import App from './App.vue';

import './assets/main.css'

const pre = document.querySelector("pre")!;
const json = JSON.parse(pre.innerText);
const root = JsonToken.create(json);
const app = createApp(App, { root })
app.mount(document.body);