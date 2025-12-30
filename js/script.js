document.querySelectorAll('.nav-links li').forEach(item => {
    item.addEventListener('click', function() {
        if (!this.querySelector('.todo-badge')) {
            const badge = document.createElement('span');
            badge.className = 'todo-badge';
            badge.innerText = 'todo';
            this.appendChild(badge);
        }
    });
});

const currentYear = new Date().getFullYear();
document.getElementsByTagName('footer')[0].appendChild(document.createTextNode(currentYear + " © shoukko.de"));