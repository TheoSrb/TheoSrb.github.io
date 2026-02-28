const THEMES = {
    dark: {
        '--navigation-bar-background-color': '#151b2d',
        '--navigation-bar-text-color': '#dddddd',
        '--content-banner-color': '#101423',
        '--content-text-color': '#eeeeee',
        '--foot-content-banner-color': '#eeeeee',
        '--object-background-color': '#232c47',
        '--object-background-color-rgb': '35, 44, 71',
        '--saturate-object-color': '#1f2c52',
        '--hiden-text-color': '#7984a5',
        '--image-alt-bg': '238, 238, 238'
    },
    light: {
        '--navigation-bar-background-color': '#e8ecf5',
        '--navigation-bar-text-color': '#2c3e50',
        '--content-banner-color': '#f5f7fa',
        '--content-text-color': '#2c3e50',
        '--foot-content-banner-color': '#2c3e50',
        '--object-background-color': '#d4dbe8',
        '--object-background-color-rgb': '212, 219, 232',
        '--saturate-object-color': '#c3d6f7',
        '--hiden-text-color': '#5a6c8f',
        '--image-alt-bg': '44, 62, 80'
    }
};

const getInitialTheme = () => {
    const saved = localStorage.getItem('portfolioTheme');
    if (saved) return saved;
    return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
};

let currentTheme = getInitialTheme();

function applyTheme(themeName) {
    const theme = THEMES[themeName];
    let styleElement = document.getElementById('dynamic-theme-style');
    
    if (!styleElement) {
        styleElement = document.createElement('style');
        styleElement.id = 'dynamic-theme-style';
        document.head.appendChild(styleElement);
    }

    let cssText = 'html, body, * {\n';
    for (const [prop, val] of Object.entries(theme)) {
        cssText += `    ${prop}: ${val} !important;\n`;
    }
    cssText += '}';
    
    styleElement.textContent = cssText;
    currentTheme = themeName;
    localStorage.setItem('portfolioTheme', themeName);
    
    const btn = document.getElementById('themeToggle');
    if (btn) {
        btn.innerHTML = themeName === 'dark' 
            ? '<i class="fa-solid fa-sun"></i><span> Mode clair</span>' 
            : '<i class="fa-solid fa-moon"></i><span> Mode sombre</span>';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    let btn = document.getElementById('themeToggle');

    if (!btn) {
        const topBar = document.querySelector('.top-bar');
        if (topBar) {
            btn = document.createElement('button');
            btn.id = 'themeToggle';
            btn.className = 'theme-toggle-btn';
            topBar.appendChild(btn);
        }
    }

    applyTheme(currentTheme);

    if (btn) {
        btn.onclick = (e) => {
            e.preventDefault();
            const next = currentTheme === 'dark' ? 'light' : 'dark';
            applyTheme(next);
            
            btn.style.transform = 'scale(0.9)';
            setTimeout(() => btn.style.transform = 'scale(1)', 150);
        };
    }
});