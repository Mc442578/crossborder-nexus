const toast = document.querySelector('.toast');
const showToast = () => {
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 2600);
};

document.querySelector('#newMission').addEventListener('click', showToast);
document.querySelector('.approve-action').addEventListener('click', () => {
  toast.querySelector('strong').textContent = 'Review decision recorded';
  toast.querySelector('small').textContent = 'The task can now continue with an audit trail.';
  showToast();
});

document.querySelectorAll('.period-switch button').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelector('.period-switch .active').classList.remove('active');
    button.classList.add('active');
  });
});

document.querySelectorAll('nav a').forEach((item) => {
  item.addEventListener('click', (event) => {
    event.preventDefault();
    document.querySelector('nav a.active').classList.remove('active');
    item.classList.add('active');
  });
});
