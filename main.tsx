import {createRoot} from 'react-dom/client';import App from './App';import './index.css';
createRoot(document.getElementById('root')!).render(<App/>);
// Lets Chrome offer "Install app". Needs the https address your host gives you.
if('serviceWorker' in navigator&&location.protocol==='https:')window.addEventListener('load',()=>{navigator.serviceWorker.register('./sw.js').catch(()=>{})});
