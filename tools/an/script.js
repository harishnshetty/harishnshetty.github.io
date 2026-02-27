/* ============================================================
   Ansible YAML Generator — script.js
   Clean rewrite: no diff markers, no duplicates
   ============================================================ */

// ── Dark mode ──────────────────────────────────────────────
(function () {
  const saved = localStorage.getItem('anDark');
  if (saved === 'true') document.documentElement.body && applyDark(true);
  document.addEventListener('DOMContentLoaded', () => {
    if (saved === 'true') applyDark(true);
  });
})();

function applyDark(on) {
  document.body.classList.toggle('dark', on);
  const btn = document.getElementById('darkToggle');
  if (btn) btn.textContent = on ? '☀️' : '🌙';
}

window.toggleDark = function () {
  const isDark = document.body.classList.toggle('dark');
  localStorage.setItem('anDark', isDark);
  const btn = document.getElementById('darkToggle');
  if (btn) btn.textContent = isDark ? '☀️' : '🌙';
};

// ── Toast ──────────────────────────────────────────────────
function showToast(msg, color = '#16a34a') {
  const t = document.createElement('div');
  t.className = 'toast';
  t.style.background = color;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2800);
}

// ── App search / filter ────────────────────────────────────
window.filterAppDropdown = function (query) {
  const q = query.trim().toLowerCase();
  const menu = document.getElementById('appDropdownMenu');
  if (!menu) return;

  const items = menu.querySelectorAll('label.dropdown-item');
  const groups = menu.querySelectorAll('.group-header');
  let totalVisible = 0;

  // Show/hide each item based on query match against label text + value
  items.forEach(label => {
    const text = label.textContent.toLowerCase();
    const val = (label.querySelector('input')?.value || '').toLowerCase();
    const show = !q || text.includes(q) || val.includes(q);
    label.style.display = show ? '' : 'none';
    if (show) totalVisible++;
  });

  // Hide group headers that have no visible items below them
  groups.forEach(header => {
    let sibling = header.nextElementSibling;
    let hasVisible = false;
    while (sibling && !sibling.classList.contains('group-header')) {
      if (sibling.tagName === 'LABEL' && sibling.style.display !== 'none') {
        hasVisible = true; break;
      }
      sibling = sibling.nextElementSibling;
    }
    header.style.display = hasVisible ? '' : 'none';
  });

  // No-results indicator
  const noRes = document.getElementById('appNoResults');
  if (noRes) noRes.style.display = totalVisible === 0 ? '' : 'none';
};

// ── Dropdown toggle ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('appDropdownButton');
  const menu = document.getElementById('appDropdownMenu');
  if (!btn || !menu) return;

  btn.addEventListener('click', e => { e.stopPropagation(); menu.classList.toggle('open'); });
  document.addEventListener('click', e => {
    if (!btn.contains(e.target) && !menu.contains(e.target)) {
      menu.classList.remove('open');
      // Clear search and reset visibility when dropdown is closed
      const searchInput = document.getElementById('appSearch');
      if (searchInput && searchInput.value) {
        searchInput.value = '';
        filterAppDropdown('');
      }
    }
  });

  document.querySelectorAll('.app-checkbox').forEach(cb => {
    cb.addEventListener('change', () => {
      syncDropdownLabel();
      const configCb = document.getElementById('configCheckbox');
      if (configCb && configCb.checked) updateConfigEditor();
    });
  });

  // Firewall toggle
  const fwCb = document.querySelector('input[value="enableFirewall"]');
  const fwOpts = document.getElementById('firewallOptions');
  if (fwCb && fwOpts) {
    fwCb.addEventListener('change', () => fwOpts.classList.toggle('hidden', !fwCb.checked));
  }

  // Config checkbox
  const configCb = document.getElementById('configCheckbox');
  if (configCb) configCb.addEventListener('change', updateConfigEditor);

  // Copy content checkbox
  const cpCb = document.getElementById('copyContentCheckbox');
  const cpSel = document.getElementById('copyContentPathSelect');
  if (cpCb && cpSel) {
    cpCb.addEventListener('change', () => {
      cpSel.classList.toggle('hidden', !cpCb.checked);
      if (cpCb.checked) {
        const apps = getSelectedApps();
        updateCopyPathDropdown(apps[0] || null);
      }
    });
  }

  if (cpSel) {
    cpSel.addEventListener('change', () => {
      const customInput = document.getElementById('customCopyPath');
      if (customInput) customInput.classList.toggle('hidden', cpSel.value !== 'custom');
    });
  }

  // OS change — purge only for Ubuntu
  const osSel = document.getElementById('os');
  if (osSel) {
    osSel.addEventListener('change', () => {
      const purge = document.getElementById('purgeConfig');
      if (purge) {
        purge.disabled = osSel.value !== 'ubuntu';
        if (osSel.value !== 'ubuntu') purge.checked = false;
      }
    });
  }

  // Init
  fetchLatestUpdate();
  setInterval(fetchLatestUpdate, 5 * 60 * 1000);
});

// ── Helpers ────────────────────────────────────────────────
function getSelectedApps() {
  return [...document.querySelectorAll('.app-checkbox:checked')].map(c => c.value);
}

function syncDropdownLabel() {
  const apps = getSelectedApps();
  const btn = document.getElementById('appDropdownButton');
  if (!btn) return;
  btn.textContent = apps.length ? apps.join(', ') : 'Select Applications';
}

// ── Config editor ──────────────────────────────────────────
const defaultConfigs = {
  nginx: `user www-data;
worker_processes auto;
pid /run/nginx.pid;
events { worker_connections 768; }
http {
  sendfile on; tcp_nopush on;
  server {
    listen 80 default_server;
    root /var/www/html;
    index index.html;
    server_name _;
    location / { try_files $uri $uri/ =404; }
  }
}`,
  apache2: `<VirtualHost *:80>
    ServerAdmin webmaster@localhost
    DocumentRoot /var/www/html
    ErrorLog \${APACHE_LOG_DIR}/error.log
    CustomLog \${APACHE_LOG_DIR}/access.log combined
</VirtualHost>`,
  httpd: `ServerRoot "/etc/httpd"
Listen 80
User apache
Group apache
DocumentRoot "/var/www/html"`,
  mysql: `[mysqld]
user=mysql
pid-file=/var/run/mysqld/mysqld.pid
socket=/var/run/mysqld/mysqld.sock
datadir=/var/lib/mysql
log-error=/var/log/mysql/error.log
bind-address=127.0.0.1`,
  mariadb: `[mysqld]
user=mariadb
datadir=/var/lib/mariadb
log-error=/var/log/mariadb/error.log`,
  postgresql: `listen_addresses = 'localhost'
port = 5432
max_connections = 100
shared_buffers = 128MB
log_directory = 'pg_log'`,
  mongodb: `storage:
  dbPath: /var/lib/mongodb
net:
  bindIp: 127.0.0.1
  port: 27017
security:
  authorization: enabled`,
  redis: `bind 127.0.0.1
port 6379
maxmemory 256mb
maxmemory-policy allkeys-lru
appendonly yes`,
  prometheus: `global:
  scrape_interval: 15s
scrape_configs:
  - job_name: 'node'
    static_configs:
      - targets: ['localhost:9100']`,
  grafana: `[server]
http_port = 3000
domain = localhost
[security]
admin_user = admin`,
  jenkins: `# Jenkins environment config
JENKINS_HOME=/var/lib/jenkins
JENKINS_PORT=8080
JENKINS_ARGS="--webroot=/var/cache/jenkins/war"`,
  sonarqube: `sonar.web.host=0.0.0.0
sonar.web.port=9000
sonar.jdbc.url=jdbc:postgresql://localhost/sonarqube`,
  elasticsearch: `cluster.name: my-cluster
node.name: node-1
network.host: 0.0.0.0
http.port: 9200
discovery.seed_hosts: ["127.0.0.1"]`,
  kibana: `server.port: 5601
server.host: "0.0.0.0"
elasticsearch.hosts: ["http://localhost:9200"]`,
};

function updateConfigEditor() {
  const configCb = document.getElementById('configCheckbox');
  const container = document.getElementById('configEditorContainer');
  const editor = document.getElementById('configEditor');
  if (!configCb || !container || !editor) return;
  if (configCb.checked) {
    const apps = getSelectedApps();
    editor.value = apps.length
      ? (defaultConfigs[apps[0]] || `# No template for ${apps[0]}`)
      : '# Select an application to load its config template';
    container.classList.remove('hidden');
  } else {
    container.classList.add('hidden');
    editor.value = '';
  }
}

// ── Copy-path dropdown ─────────────────────────────────────
const appToPaths = {
  nginx: ['/var/www/html/index.html', '/etc/nginx/sites-available/default'],
  httpd: ['/var/www/html/index.html', '/etc/httpd/conf/httpd.conf'],
  apache2: ['/var/www/html/index.html', '/etc/apache2/sites-available/000-default.conf'],
  mysql: ['/etc/mysql/my.cnf'],
  mariadb: ['/etc/mysql/my.cnf', '/etc/mariadb/mariadb.conf.d/'],
  mongodb: ['/etc/mongod.conf', '/var/lib/mongodb/'],
  postgresql: ['/etc/postgresql/14/main/postgresql.conf'],
  redis: ['/etc/redis/redis.conf'],
  jenkins: ['/etc/default/jenkins'],
  sonarqube: ['/opt/sonarqube/conf/sonar.properties'],
  elasticsearch: ['/etc/elasticsearch/elasticsearch.yml'],
  kibana: ['/etc/kibana/kibana.yml'],
};

function updateCopyPathDropdown(app) {
  const sel = document.getElementById('copyContentPathSelect');
  if (!sel) return;
  sel.innerHTML = '';
  const paths = (app && appToPaths[app]) || ['/var/www/html/index.html'];
  paths.forEach(p => {
    const o = document.createElement('option');
    o.value = p; o.textContent = p;
    sel.appendChild(o);
  });
  const cust = document.createElement('option');
  cust.value = 'custom'; cust.textContent = '🔧 Enter custom path';
  sel.appendChild(cust);
}

// ── Package manager helpers ────────────────────────────────
function pkgModule(os) {
  const map = {
    ubuntu: 'apt', debian: 'apt',
    redhat: 'dnf', rocky: 'dnf', alma: 'dnf', oracle: 'dnf', centos: 'dnf', fedora: 'dnf',
    amazon: 'yum',
    suse: 'zypper', opensuse: 'zypper',
    alpine: 'apk',
  };
  return map[os] || 'apt';
}

// Special package names per OS
const pkgNames = {
  docker: { ubuntu: 'docker.io', debian: 'docker.io', redhat: 'docker-ce', centos: 'docker-ce', amazon: 'docker', alpine: 'docker' },
  git: { ubuntu: 'git', redhat: 'git', amazon: 'git', alpine: 'git' },
  nodejs: { ubuntu: 'nodejs', redhat: 'nodejs', amazon: 'nodejs', alpine: 'nodejs' },
  jenkins: { ubuntu: 'jenkins', redhat: 'jenkins', amazon: 'jenkins', alpine: 'jenkins' },
  sonarqube: { ubuntu: 'sonarqube', redhat: 'sonarqube', amazon: 'sonarqube' },
  elasticsearch: { ubuntu: 'elasticsearch', redhat: 'elasticsearch', amazon: 'elasticsearch' },
  kibana: { ubuntu: 'kibana', redhat: 'kibana', amazon: 'kibana' },
  // Kubernetes tools
  kubectl: { ubuntu: 'kubectl', redhat: 'kubectl', amazon: 'kubectl', alpine: 'kubectl' },
  helm: { ubuntu: 'helm', redhat: 'helm', amazon: 'helm', alpine: 'helm' },
  eksctl: { ubuntu: 'eksctl', redhat: 'eksctl', amazon: 'eksctl' },        // binary via curl
  k9s: { ubuntu: 'k9s', redhat: 'k9s', amazon: 'k9s' },           // binary via curl
  minikube: { ubuntu: 'minikube', redhat: 'minikube', amazon: 'minikube' },
  kind: { ubuntu: 'kind', redhat: 'kind', amazon: 'kind' },          // binary via curl
  kustomize: { ubuntu: 'kustomize', redhat: 'kustomize', amazon: 'kustomize' },     // binary via curl
  argocd: { ubuntu: 'argocd', redhat: 'argocd', amazon: 'argocd' },        // binary via curl
  fluxcd: { ubuntu: 'flux', redhat: 'flux', amazon: 'flux' },          // binary via curl
  // Cloud CLI
  'aws-cli': { ubuntu: 'awscli', debian: 'awscli', redhat: 'awscli', amazon: 'awscli', alpine: 'aws-cli' },
  'azure-cli': { ubuntu: 'azure-cli', redhat: 'azure-cli', amazon: 'azure-cli' },
  gcloud: { ubuntu: 'google-cloud-cli', redhat: 'google-cloud-sdk', amazon: 'google-cloud-sdk' },
  // IaC
  packer: { ubuntu: 'packer', redhat: 'packer', amazon: 'packer' },
  nomad: { ubuntu: 'nomad', redhat: 'nomad', amazon: 'nomad' },
  consul: { ubuntu: 'consul', redhat: 'consul', amazon: 'consul' },
  pulumi: { ubuntu: 'pulumi', redhat: 'pulumi', amazon: 'pulumi' },
  // Security
  trivy: { ubuntu: 'trivy', redhat: 'trivy', amazon: 'trivy' },
  falco: { ubuntu: 'falco', redhat: 'falco', amazon: 'falco' },
  certbot: { ubuntu: 'certbot', redhat: 'certbot', amazon: 'certbot', alpine: 'certbot' },
  // Web / Proxy
  haproxy: { ubuntu: 'haproxy', redhat: 'haproxy', amazon: 'haproxy', alpine: 'haproxy' },
  traefik: { ubuntu: 'traefik', redhat: 'traefik', amazon: 'traefik' },       // binary/docker
  caddy: { ubuntu: 'caddy', redhat: 'caddy', amazon: 'caddy', alpine: 'caddy' },
  keepalived: { ubuntu: 'keepalived', redhat: 'keepalived', amazon: 'keepalived', alpine: 'keepalived' },
};

function resolvePackageName(os, app) {
  return (pkgNames[app] && pkgNames[app][os]) || app;
}

// Service names (sometimes differ from package)
const serviceNames = {
  apache2: 'apache2', httpd: 'httpd', mysql: 'mysql',
  mariadb: 'mariadb', postgresql: 'postgresql', mongodb: 'mongod',
  redis: 'redis', prometheus: 'prometheus', grafana: 'grafana-server',
  jenkins: 'jenkins', elasticsearch: 'elasticsearch', kibana: 'kibana',
  'zabbix-agent': 'zabbix-agent', sonarqube: 'sonarqube', docker: 'docker',
  vault: 'vault', nexus: 'nexus', node_exporter: 'node_exporter',
  alertmanager: 'alertmanager', logstash: 'logstash',
  // Kubernetes (typically no daemon service — CLI tools)
  kubectl: null, helm: null, eksctl: null, k9s: null, minikube: 'minikube',
  kind: null, kustomize: null, argocd: 'argocd-server', fluxcd: null,
  // Cloud CLI (no daemon)
  'aws-cli': null, 'azure-cli': null, gcloud: null,
  // IaC
  packer: null, pulumi: null, consul: 'consul', nomad: 'nomad', vault: 'vault',
  // Security
  trivy: null, falco: 'falco', certbot: 'certbot',
  // Web / Proxy
  haproxy: 'haproxy', traefik: 'traefik', caddy: 'caddy', keepalived: 'keepalived',
};
function svcName(app) { return serviceNames[app] || app; }

// Config destination paths
function configDest(app) {
  const m = {
    nginx: '/etc/nginx/nginx.conf', apache2: '/etc/apache2/apache2.conf',
    httpd: '/etc/httpd/conf/httpd.conf', mysql: '/etc/mysql/my.cnf',
    mariadb: '/etc/mysql/mariadb.conf.d/50-server.cnf',
    postgresql: '/etc/postgresql/14/main/postgresql.conf',
    mongodb: '/etc/mongod.conf', redis: '/etc/redis/redis.conf',
    prometheus: '/etc/prometheus/prometheus.yml',
    grafana: '/etc/grafana/grafana.ini', jenkins: '/etc/default/jenkins',
    elasticsearch: '/etc/elasticsearch/elasticsearch.yml',
    kibana: '/etc/kibana/kibana.yml',
    sonarqube: '/opt/sonarqube/conf/sonar.properties',
  };
  return m[app] || `/etc/${app}/${app}.conf`;
}

// User mappings
const userMap = {
  nginx: { name: 'www-data', home: '/var/www', group: 'www-data' },
  httpd: { name: 'apache', home: '/var/www', group: 'apache' },
  apache2: { name: 'www-data', home: '/var/www', group: 'www-data' },
  mysql: { name: 'mysql', home: '/var/lib/mysql', group: 'mysql' },
  mariadb: { name: 'mariadb', home: '/var/lib/mariadb', group: 'mariadb' },
  mongodb: { name: 'mongodb', home: '/var/lib/mongodb', group: 'mongodb' },
  postgresql: { name: 'postgres', home: '/var/lib/postgresql', group: 'postgres' },
  redis: { name: 'redis', home: '/var/lib/redis', group: 'redis' },
  jenkins: { name: 'jenkins', home: '/var/lib/jenkins', group: 'jenkins' },
  prometheus: { name: 'prometheus', home: '/var/lib/prometheus', group: 'prometheus' },
  elasticsearch: { name: 'elasticsearch', home: '/var/lib/elasticsearch', group: 'elasticsearch' },
  sonarqube: { name: 'sonarqube', home: '/opt/sonarqube', group: 'sonarqube' },
};

// ── Basic packages ─────────────────────────────────────────
const basicPkgs = {
  // apt family
  ubuntu: ['vim', 'nano', 'curl', 'wget', 'git', 'htop', 'net-tools', 'iproute2', 'dnsutils', 'ca-certificates', 'gnupg', 'openssh-client', 'sudo', 'unzip', 'lsof'],
  debian: ['vim', 'nano', 'curl', 'wget', 'git', 'htop', 'net-tools', 'iproute2', 'dnsutils', 'ca-certificates', 'gnupg', 'openssh-client', 'sudo', 'unzip', 'lsof'],
  // dnf family
  redhat: ['vim', 'nano', 'curl', 'wget', 'git', 'htop', 'net-tools', 'iproute', 'bind-utils', 'ca-certificates', 'gnupg2', 'openssh-clients', 'sudo', 'unzip', 'lsof'],
  rocky: ['vim', 'nano', 'curl', 'wget', 'git', 'htop', 'net-tools', 'iproute', 'bind-utils', 'ca-certificates', 'gnupg2', 'openssh-clients', 'sudo', 'unzip', 'lsof'],
  alma: ['vim', 'nano', 'curl', 'wget', 'git', 'htop', 'net-tools', 'iproute', 'bind-utils', 'ca-certificates', 'gnupg2', 'openssh-clients', 'sudo', 'unzip', 'lsof'],
  oracle: ['vim', 'nano', 'curl', 'wget', 'git', 'htop', 'net-tools', 'iproute', 'bind-utils', 'ca-certificates', 'gnupg2', 'openssh-clients', 'sudo', 'unzip', 'lsof'],
  centos: ['vim', 'nano', 'curl', 'wget', 'git', 'htop', 'net-tools', 'iproute', 'bind-utils', 'ca-certificates', 'gnupg2', 'openssh-clients', 'sudo', 'unzip', 'lsof'],
  fedora: ['vim', 'nano', 'curl', 'wget', 'git', 'htop', 'net-tools', 'iproute', 'bind-utils', 'ca-certificates', 'gnupg2', 'openssh-clients', 'sudo', 'unzip', 'lsof'],
  // yum family
  amazon: ['vim', 'nano', 'curl', 'wget', 'git', 'htop', 'net-tools', 'iproute', 'bind-utils', 'ca-certificates', 'gnupg2', 'openssh-clients', 'sudo', 'unzip', 'lsof'],
  // zypper family
  suse: ['vim', 'nano', 'curl', 'wget', 'git', 'htop', 'net-tools', 'iproute2', 'bind-utils', 'ca-certificates', 'gpg2', 'openssh', 'sudo', 'unzip', 'lsof'],
  opensuse: ['vim', 'nano', 'curl', 'wget', 'git', 'htop', 'net-tools', 'iproute2', 'bind-utils', 'ca-certificates', 'gpg2', 'openssh', 'sudo', 'unzip', 'lsof'],
  // apk family
  alpine: ['vim', 'nano', 'curl', 'wget', 'git', 'htop', 'net-tools', 'iproute2', 'bind-tools', 'ca-certificates', 'gnupg', 'openssh', 'sudo', 'unzip', 'lsof'],
};

// ── YAML builder helpers ───────────────────────────────────
// Global error-handling flags read once per generation
let _ignoreErrors = false;
let _failedWhen = false;

function task(name, module, args, extra = {}) {
  let s = `  - name: ${name}\n    ${module}:\n`;
  Object.entries(args).forEach(([k, v]) => { s += `      ${k}: ${v}\n`; });
  if (extra.tags) s += `    tags: [${extra.tags.join(', ')}]\n`;
  if (extra.when) s += `    when: ${extra.when}\n`;
  if (extra.notify) s += `    notify: ${extra.notify}\n`;
  // Inject task-level error handling if enabled globally
  if (_ignoreErrors) s += `    ignore_errors: yes\n`;
  if (_failedWhen) s += `    failed_when: false\n`;
  return s + '\n';
}

function installTask(os, app) {
  const pm = pkgModule(os);
  const pkg = resolvePackageName(os, app);
  const args = { name: pkg, state: 'present' };
  if (pm === 'apt') args.update_cache = 'yes';
  if (pm === 'zypper') args.type = 'package';
  return task(`Install ${app}`, pm, args, { tags: ['install', app] });
}

function removeTask(os, app) {
  const pm = pkgModule(os);
  const pkg = resolvePackageName(os, app);
  const args = { name: pkg, state: 'absent' };
  const purge = document.getElementById('purgeConfig')?.checked;
  if (pm === 'apt' && purge) args.purge = 'yes';
  if (pm === 'zypper') args.type = 'package';
  return task(`Remove ${app}`, pm, args, { tags: ['remove', app] });
}

function serviceTask(app, state, label) {
  const sn = svcName(app);
  const enabled = (state === 'started') ? 'yes' : 'no';
  return task(`${label} ${app} service`, 'service',
    { name: sn, state: state, enabled: enabled },
    { tags: [label.toLowerCase(), app] });
}

function updateTask(os) {
  const pm = pkgModule(os);
  if (pm === 'apt') return task('Update apt cache', 'apt', { update_cache: 'yes', cache_valid_time: '3600' });
  if (pm === 'dnf') return task('Update DNF packages', 'dnf', { name: '"*"', state: 'latest' });
  if (pm === 'yum') return task('Update YUM packages', 'yum', { name: '"*"', state: 'latest' });
  if (pm === 'zypper') return task('Refresh zypper repositories', 'zypper', { refresh: 'yes' })
    + task('Update all zypper packages', 'zypper', { name: '"*"', state: 'latest' });
  if (pm === 'apk') return task('Update APK cache', 'apk', { update_cache: 'yes' });
  return '';
}

function basicAppTask(os) {
  const pm = pkgModule(os);
  const pkgs = basicPkgs[os] || basicPkgs.ubuntu;
  let s = `  - name: Install basic packages\n    ${pm}:\n      name:\n`;
  pkgs.forEach(p => { s += `        - ${p}\n`; });
  s += `      state: present\n`;
  if (pm === 'apt') s += `      update_cache: yes\n`;
  if (pm === 'zypper') s += `      type: package\n`;
  return s + '\n';
}

function configTask(app, content) {
  const dest = configDest(app);
  const ind = content.split('\n').map(l => '      ' + l).join('\n');
  return `  - name: Deploy ${app} configuration\n    copy:\n      content: |\n${ind}\n      dest: ${dest}\n      owner: root\n      group: root\n      mode: '0644'\n    tags: [config, ${app}]\n    notify: Restart ${app}\n\n`;
}

function userTask(app) {
  const u = userMap[app] || { name: 'svcuser', home: '/home/svcuser', group: 'svcuser' };
  return task(`Ensure group ${u.group} exists`, 'group', { name: u.group, state: 'present' })
    + task(`Create ${u.name} user`, 'user',
      {
        name: u.name, group: u.group, home: u.home, shell: '/sbin/nologin',
        state: 'present', create_home: 'yes'
      }, { tags: ['user', app] });
}

function copyContentTask(app) {
  let path = document.getElementById('copyContentPathSelect')?.value;
  if (path === 'custom') path = document.getElementById('customCopyPath')?.value?.trim() || '/var/www/html/index.html';
  return task(`Copy content to ${path}`, 'copy',
    { src: 'files/index.html', dest: path, owner: 'root', group: 'root', mode: "'0644'" },
    { tags: ['deploy', app || 'general'] });
}

function sslTask(app) {
  return task(`Copy SSL certificate for ${app}`, 'copy',
    { src: 'files/ssl.crt', dest: `/etc/ssl/certs/${app}.crt`, owner: 'root', group: 'root', mode: "'0644'" })
    + task(`Copy SSL private key for ${app}`, 'copy',
      { src: 'files/ssl.key', dest: `/etc/ssl/private/${app}.key`, owner: 'root', group: 'root', mode: "'0600'" });
}

function firewallTasks() {
  const tool = document.getElementById('firewallTool')?.value || 'ufw';
  const ports = [...document.querySelectorAll('.fw-port:checked')].map(p => p.value);
  let s = '';
  if (tool === 'ufw') {
    s += task('Enable UFW firewall', 'ufw', { state: 'enabled', policy: 'allow' });
    ports.forEach(p => { s += task(`Allow port ${p}/tcp`, 'ufw', { rule: 'allow', port: p, proto: 'tcp' }); });
  } else if (tool === 'firewalld') {
    s += task('Ensure firewalld is running', 'service', { name: 'firewalld', state: 'started', enabled: 'yes' });
    ports.forEach(p => {
      s += task(`Allow port ${p}/tcp via firewalld`, 'firewalld',
        { port: `${p}/tcp`, permanent: 'true', state: 'enabled', immediate: 'yes' });
    });
  } else {
    ports.forEach(p => {
      s += `  - name: Allow port ${p} via iptables\n    command: iptables -A INPUT -p tcp --dport ${p} -j ACCEPT\n\n`;
    });
    s += task('Save iptables rules', 'command', { cmd: 'iptables-save > /etc/iptables/rules.v4' });
  }
  return s;
}

function handlersBlock(apps, actions) {
  if (!actions.includes('install') && !actions.includes('reload')) return '';
  let s = '\n  handlers:\n';
  apps.forEach(app => {
    if (svcName(app)) {
      s += `    - name: Restart ${app}\n      service:\n        name: ${svcName(app)}\n        state: restarted\n\n`;
    }
  });
  return s;
}

function varsBlock(os, apps) {
  let s = '  vars:\n';
  s += `    ansible_os: "${os}"\n`;
  if (apps.length) s += `    managed_apps:\n` + apps.map(a => `      - ${a}`).join('\n') + '\n';
  return s + '\n';
}

// ── MAIN: Generate YAML ────────────────────────────────────
window.generateYAML = function () {
  const os = document.getElementById('os')?.value || 'ubuntu';
  const hostsVal = document.getElementById('hostsInput')?.value?.trim() || 'all';
  const becomeUser = document.getElementById('becomeUserInput')?.value?.trim();
  const gatherFacts = document.getElementById('gatherFacts')?.checked !== false;
  const addVars = document.getElementById('addVarsCheckbox')?.checked;

  // Error handling flags — read once, used by task() helper
  const anyErrorsFatal = document.getElementById('anyErrorsFatalCheckbox')?.checked;
  const maxFailPct = document.getElementById('maxFailPctCheckbox')?.checked;
  _ignoreErrors = document.getElementById('ignoreErrorsCheckbox')?.checked || false;
  _failedWhen = document.getElementById('failedWhenCheckbox')?.checked || false;

  const apps = getSelectedApps();
  const actions = [...document.querySelectorAll('.action:checked')].map(e => e.value);
  const features = [...document.querySelectorAll('.feature:checked')].map(e => e.value);
  const configContent = document.getElementById('configEditor')?.value || '';

  // ── Play header ──────────────────────────────────────────
  let yaml = `---\n- name: Manage infrastructure on ${os}\n  hosts: ${hostsVal}\n  become: true\n`;
  if (becomeUser) yaml += `  become_user: ${becomeUser}\n`;
  yaml += `  gather_facts: ${gatherFacts}\n`;

  // Play-level error handling
  if (anyErrorsFatal) yaml += `  any_errors_fatal: true\n`;
  if (maxFailPct) yaml += `  max_fail_percentage: 0\n`;

  // Inline comment explaining strategy when both conflict
  if (_ignoreErrors && anyErrorsFatal) {
    yaml += `  # ⚠️  NOTE: ignore_errors (task) and any_errors_fatal (play) are both set.\n`;
    yaml += `  #     ignore_errors prevents failures from reaching any_errors_fatal.\n`;
    yaml += `  #     Use ignore_errors selectively per task in production instead.\n`;
  }

  if (addVars) yaml += varsBlock(os, apps);
  yaml += `\n  tasks:\n`;

  // System update
  if (actions.includes('sys-update')) yaml += updateTask(os);

  // Basic packages
  if (actions.includes('basic-app')) yaml += basicAppTask(os);

  // Per-app tasks
  apps.forEach(app => {
    yaml += `    # ── ${app.toUpperCase()} ──────────────────────────────\n`;
    if (actions.includes('install')) yaml += installTask(os, app);
    if (actions.includes('start')) yaml += serviceTask(app, 'started', 'Start');
    if (actions.includes('stop')) yaml += serviceTask(app, 'stopped', 'Stop');
    if (actions.includes('enable')) yaml += serviceTask(app, 'started', 'Enable');
    if (actions.includes('disable')) yaml += serviceTask(app, 'stopped', 'Disable');
    if (actions.includes('reload')) yaml += task(`Reload ${app} service`, 'service', { name: svcName(app), state: 'reloaded' }, { tags: ['reload', app] });
    if (actions.includes('remove')) yaml += removeTask(os, app);
    if (features.includes('user')) yaml += userTask(app);
    if (features.includes('config') && configContent) yaml += configTask(app, configContent);
    if (features.includes('cp-content')) yaml += copyContentTask(app);
    if (features.includes('ssl')) yaml += sslTask(app);
  });

  // Global features (no apps selected)
  if (apps.length === 0) {
    if (features.includes('config') && configContent) {
      const ind = configContent.split('\n').map(l => '      ' + l).join('\n');
      yaml += `  - name: Apply general configuration\n    copy:\n      content: |\n${ind}\n      dest: /etc/app.conf\n      owner: root\n      group: root\n      mode: '0644'\n\n`;
    }
    if (features.includes('cp-content')) yaml += copyContentTask(null);
  }

  // Firewall
  if (features.includes('enableFirewall')) yaml += firewallTasks();

  // Handlers
  if (apps.length && (actions.includes('install') || actions.includes('reload') || features.includes('config'))) {
    yaml += handlersBlock(apps, actions);
  }

  const out = document.getElementById('output');
  if (out) {
    out.innerHTML = syntaxHighlight(yaml);
    out.dataset.raw = yaml;
  }
};


// ── YAML syntax highlighting ───────────────────────────────
function syntaxHighlight(text) {
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return text.split('\n').map(line => {
    const e = esc(line);
    // comment
    if (/^\s*#/.test(line)) return `<span class="yaml-comment">${e}</span>`;
    // list dash
    const dashM = e.match(/^(\s*)(-\s+)(name:.*)$/);
    if (dashM) return `${dashM[1]}<span class="yaml-dash">${dashM[2]}</span><span class="yaml-key">${dashM[3]}</span>`;
    // key: value
    const kvM = e.match(/^(\s*)(\S[^:]*)(:\s*)(.+)$/);
    if (kvM) {
      const val = kvM[4];
      let vspan = val;
      if (/^(yes|no|true|false)$/i.test(val.trim())) vspan = `<span class="yaml-bool">${val}</span>`;
      else if (/^\d+$/.test(val.trim())) vspan = `<span class="yaml-num">${val}</span>`;
      else vspan = `<span class="yaml-str">${val}</span>`;
      return `${kvM[1]}<span class="yaml-key">${kvM[2]}${kvM[3]}</span>${vspan}`;
    }
    // key only
    const keyM = e.match(/^(\s*)(\S[^:]*)(:)\s*$/);
    if (keyM) return `${keyM[1]}<span class="yaml-key">${keyM[2]}${keyM[3]}</span>`;
    return e;
  }).join('\n');
}

// ── Copy / Download / Clear ────────────────────────────────
window.copyYAML = function () {
  const out = document.getElementById('output');
  const text = out?.dataset.raw || out?.innerText;
  if (!text) { showToast('⚠️ Nothing to copy', '#d97706'); return; }
  navigator.clipboard.writeText(text).then(() => showToast('✅ YAML copied!')).catch(() => showToast('❌ Copy failed', '#dc2626'));
};

window.downloadYAML = async function () {
  const out = document.getElementById('output');
  const yaml = out?.dataset.raw || out?.innerText;
  if (!yaml) { showToast('⚠️ Nothing to download', '#d97706'); return; }

  const name = document.getElementById('downloadName')?.value?.trim() || 'playbook';
  const os = document.getElementById('os')?.value || 'ubuntu';
  const apps = getSelectedApps();
  const actions = [...document.querySelectorAll('.action:checked')].map(e => e.value);
  const hostsVal = document.getElementById('hostsInput')?.value?.trim() || 'all';

  if (apps.length === 0 || typeof JSZip === 'undefined') {
    // ── plain .yml fallback ────────────────────────────────
    const blob = new Blob([yaml], { type: 'text/yaml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `${name}.yml`; a.click();
    showToast('⬇️ Downloaded!');
    return;
  }

  // ── FULL PROJECT STRUCTURE ZIP ─────────────────────────────
  const checkedDirs = [...document.querySelectorAll('.role-file:checked')].map(c => c.value);
  const dirs = checkedDirs.length
    ? checkedDirs
    : ['tasks', 'handlers', 'defaults', 'vars', 'files', 'templates', 'meta', 'tests'];

  const zip = new JSZip();
  const zipRoot = zip.folder(name);
  const rolesFolder = zipRoot.folder('roles');
  const roleNameList = [];

  apps.forEach(app => {
    const appSuffix = actions.includes('remove') ? 'remove' : 'setup';
    const roleName = `${app.replace(/-/g, '_')}_${appSuffix}`;
    roleNameList.push({ app, roleName });

    const roleDir = rolesFolder.folder(roleName);
    roleDir.file('README.md', buildAppRoleReadme(app, roleName, actions));
    if (dirs.includes('tasks')) roleDir.folder('tasks').file('main.yml', buildAppRoleTasks(os, app, actions));
    if (dirs.includes('handlers')) roleDir.folder('handlers').file('main.yml', buildAppRoleHandlers(app));
    if (dirs.includes('defaults')) roleDir.folder('defaults').file('main.yml', buildAppRoleDefaults(os, app, roleName));
    if (dirs.includes('vars')) roleDir.folder('vars').file('main.yml', buildAppRoleVars(app));
    if (dirs.includes('files')) roleDir.folder('files').file('.gitkeep', '');
    if (dirs.includes('templates')) roleDir.folder('templates').file('.gitkeep', '');
    if (dirs.includes('meta')) roleDir.folder('meta').file('main.yml', buildAppRoleMeta(app, roleName));
    if (dirs.includes('tests')) {
      const t = roleDir.folder('tests');
      t.file('inventory', `#SPDX-License-Identifier: MIT-0\nlocalhost\n`);
      t.file('test.yml', `#SPDX-License-Identifier: MIT-0\n---\n- name: Test ${roleName}\n  hosts: ${hostsVal}\n  become: true\n  roles:\n    - role: ${roleName}\n`);
    }
  });

  const siteYmlContent = (document.querySelectorAll('#rootTableBody tr').length > 0) ? generateSiteYAML() : buildZipSiteYml(roleNameList, hostsVal);
  zipRoot.file('site.yml', siteYmlContent);
  zipRoot.file('ansible.cfg', generateAnsibleCfg());
  zipRoot.file('inventory.ini', generateInventoryINI());
  const roleListMd = roleNameList.map(r => `- \`roles/${r.roleName}\` — manages **${r.app}**`).join('\n');
  zipRoot.file('README.md',
    `# ${name}\n\nGenerated by [Ansible YAML Generator](https://harishnshetty.github.io/tools/an/)\n\n## Roles\n${roleListMd}\n\n## Usage\n\`\`\`bash\nansible-playbook -i inventory.ini site.yml\nansible-playbook -i inventory.ini site.yml --tags web\nansible-playbook -i inventory.ini site.yml --limit databases\n\`\`\`\n`);

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${name}.zip`;
  a.click();
  showToast(`📦 ${name}.zip downloaded!`, '#7c3aed');
};

window.clearYAML = function () {
  const out = document.getElementById('output');
  if (out) out.innerHTML = '';
};

// ── Update banner ──────────────────────────────────────────
async function fetchLatestUpdate() {
  try {
    const url = 'https://script.google.com/macros/s/AKfycbxZVmJjswUOGZLNm2zR9afxjzUeSHccbW_pSXwmeaPMFVa-oJSteKwJNFWS423h5FSj/exec';
    const res = await fetch(url);
    const json = await res.json();
    const data = Array.isArray(json) ? json : json.data;
    if (!Array.isArray(data) || data.length < 2) return;
    const [ts, msg] = data[data.length - 1];
    const fmt = new Date(ts).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
    const bar = document.getElementById('latestUpdate');
    const span = document.getElementById('updateMessage');
    if (span) span.textContent = `🕒 ${fmt} — ${msg}`;
    if (bar) bar.classList.remove('hidden');
  } catch (_) { /* silent */ }
}

// ══════════════════════════════════════════════════════════════
//  ANSIBLE GALAXY ROLE INIT
// ══════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  const cb = document.getElementById('galaxyRoleCheckbox');
  const opt = document.getElementById('galaxyOptions');
  const zipBtn = document.getElementById('downloadRoleBtn');
  if (!cb || !opt) return;

  cb.addEventListener('change', () => {
    opt.classList.toggle('hidden', !cb.checked);
    if (zipBtn) zipBtn.style.display = cb.checked ? 'inline-flex' : 'none';
    if (cb.checked) updateRolePreview();
  });
  document.querySelectorAll('.role-file').forEach(el => el.addEventListener('change', updateRolePreview));
  const rn = document.getElementById('roleName');
  if (rn) rn.addEventListener('input', updateRolePreview);
});

function updateRolePreview() {
  const name = document.getElementById('roleName')?.value?.trim() || 'my_role';
  const dirs = [...document.querySelectorAll('.role-file:checked')].map(c => c.value);
  const pre = document.getElementById('rolePreview');
  if (!pre) return;
  const fileMap = {
    tasks: ['tasks/', '│   └── main.yml'],
    handlers: ['handlers/', '│   └── main.yml'],
    defaults: ['defaults/', '│   └── main.yml'],
    vars: ['vars/', '│   └── main.yml'],
    files: ['files/', '│   └── (static files)'],
    templates: ['templates/', '│   └── (j2 templates)'],
    meta: ['meta/', '│   └── main.yml'],
    tests: ['tests/', '│   ├── inventory', '│   └── test.yml'],
  };
  const lines = [`${name}/`, '├── README.md'];
  dirs.forEach((d, i) => {
    const isLast = i === dirs.length - 1;
    const pfx = isLast ? '└── ' : '├── ';
    if (fileMap[d]) {
      lines.push(pfx + fileMap[d][0]);
      fileMap[d].slice(1).forEach(f => lines.push('    ' + f));
    }
  });
  pre.textContent = lines.join('\n');
}

// ── Role file builders ────────────────────────────────────────
function buildRoleTasks(os, apps, actions) {
  if (!apps.length && !actions.includes('sys-update') && !actions.includes('basic-app')) {
    return `#SPDX-License-Identifier: MIT-0\n---\n# tasks/main.yml\n- name: Example task\n  debug:\n    msg: "Role applied successfully"\n`;
  }
  let out = `#SPDX-License-Identifier: MIT-0\n---\n# tasks/main.yml — auto-generated\n\n`;
  if (actions.includes('sys-update')) {
    const pm = pkgModule(os);
    if (pm === 'apt') out += `- name: Update apt cache\n  apt:\n    update_cache: yes\n    cache_valid_time: 3600\n\n`;
    else if (pm === 'dnf') out += `- name: Update all packages\n  dnf:\n    name: "*"\n    state: latest\n\n`;
    else if (pm === 'yum') out += `- name: Update all packages\n  yum:\n    name: "*"\n    state: latest\n\n`;
    else if (pm === 'zypper') out += `- name: Refresh zypper repos\n  zypper:\n    refresh: yes\n\n`;
    else if (pm === 'apk') out += `- name: Update apk cache\n  apk:\n    update_cache: yes\n\n`;
  }
  if (actions.includes('basic-app')) {
    const pm = pkgModule(os); const pkgs = basicPkgs[os] || basicPkgs.ubuntu;
    out += `- name: Install basic packages\n  ${pm}:\n    name:\n` + pkgs.map(p => `      - ${p}`).join('\n') + `\n    state: present\n` + (pm === 'apt' ? `    update_cache: yes\n` : '') + `\n`;
  }
  apps.forEach(app => {
    const pm = pkgModule(os); const pkg = resolvePackageName(os, app);
    out += `# ── ${app} ──\n`;
    if (actions.includes('install')) out += `- name: Install ${app}\n  ${pm}:\n    name: ${pkg}\n    state: present\n` + (pm === 'apt' ? `    update_cache: yes\n` : '') + `\n`;
    if (actions.includes('start')) out += `- name: Start and enable ${app}\n  service:\n    name: ${svcName(app)}\n    state: started\n    enabled: yes\n  tags: [${app}, service]\n\n`;
    if (actions.includes('stop')) out += `- name: Stop ${app}\n  service:\n    name: ${svcName(app)}\n    state: stopped\n    enabled: no\n\n`;
    if (actions.includes('reload')) out += `- name: Reload ${app}\n  service:\n    name: ${svcName(app)}\n    state: reloaded\n  notify: Restart ${app}\n\n`;
    if (actions.includes('remove')) {
      const purge = document.getElementById('purgeConfig')?.checked;
      out += `- name: Remove ${app}\n  ${pm}:\n    name: ${pkg}\n    state: absent\n` + (pm === 'apt' && purge ? `    purge: yes\n` : '') + `\n`;
    }
  });
  return out;
}

function buildRoleHandlers(apps) {
  if (!apps.length) return `#SPDX-License-Identifier: MIT-0\n---\n# handlers/main.yml\n`;
  return `#SPDX-License-Identifier: MIT-0\n---\n# handlers/main.yml\n\n` + apps.map(a => `- name: Restart ${a}\n  service:\n    name: ${svcName(a)}\n    state: restarted\n`).join('\n');
}

function buildRoleDefaults(os, apps) {
  const rn = document.getElementById('roleName')?.value?.trim() || 'my_role';
  let out = `#SPDX-License-Identifier: MIT-0\n---\n# defaults/main.yml — lowest priority variables\n\n${rn}_os: "${os}"\n`;
  if (apps.length) out += `\n${rn}_packages:\n` + apps.map(a => `  - ${resolvePackageName(os, a)}`).join('\n') + '\n';
  return out;
}

function buildRoleVars(apps) {
  let out = `#SPDX-License-Identifier: MIT-0\n---\n# vars/main.yml — high priority variables\n\n`;
  if (apps.length) out += apps.map(a => `${a}_service_state: started\n${a}_service_enabled: yes`).join('\n') + '\n';
  else out += `# Add your variables here\n`;
  return out;
}

function buildRoleMeta(apps) {
  const author = document.getElementById('roleAuthor')?.value?.trim() || 'your_name';
  const desc = document.getElementById('roleDescription')?.value?.trim() || 'An Ansible role';
  const license = document.getElementById('roleLicense')?.value || 'MIT';
  const minAns = document.getElementById('roleMinAnsible')?.value || '2.20';
  const company = document.getElementById('roleCompany')?.value?.trim() || '';
  const os = document.getElementById('os')?.value || 'ubuntu';
  const platMap = {
    ubuntu: 'Ubuntu', debian: 'Debian', redhat: 'EL', rocky: 'EL', alma: 'EL',
    oracle: 'EL', centos: 'EL', fedora: 'Fedora', amazon: 'Amazon',
    suse: 'SLES', opensuse: 'opensuse', alpine: 'Alpine'
  };
  const companyLine = company ? `  company: "${company}"\n` : `  # company: your company (optional)\n`;
  return `#SPDX-License-Identifier: ${license}\ngalaxy_info:\n  author: ${author}\n  description: ${desc}\n${companyLine}\n  # If the issue tracker for your role is not on github, uncomment the\n  # next line and provide a value\n  # issue_tracker_url: http://example.com/issue/tracker\n\n  # Choose a valid license ID from https://spdx.org - some suggested licenses:\n  # - BSD-3-Clause (default)\n  # - MIT\n  # - GPL-2.0-or-later\n  # - GPL-3.0-only\n  # - Apache-2.0\n  # - CC-BY-4.0\n  license: ${license}\n\n  min_ansible_version: "${minAns}"\n\n  platforms:\n    - name: ${platMap[os] || 'EL'}\n      versions:\n        - all\n\n  galaxy_tags:\n    - system\n    - automation\n    # NOTE: A tag is limited to a single word comprised of alphanumeric characters.\n    #       Maximum 20 tags per role.\n\ndependencies: []\n  # List your role dependencies here, one per line. Be sure to remove the '[]' above,\n  # if you add dependencies to this list.\n`;
}

function buildRoleReadme(roleName, desc, apps) {
  const author = document.getElementById('roleAuthor')?.value?.trim() || 'your_name';
  const license = document.getElementById('roleLicense')?.value || 'BSD';
  const pkg_list = apps.length
    ? apps.map(a => `  - ${a}_package: "${a}"`).join('\n')
    : '  # role_variable: value';
  return `${roleName}\n${'='.repeat(roleName.length)}\n\n${desc || 'A brief description of the role goes here.'}\n\nRequirements\n------------\n\nAny pre-requisites that may not be covered by Ansible itself or the role should be mentioned here. For instance, if the role uses the EC2 module, it may be a good idea to mention in this section that the boto package is required.\n\nRole Variables\n--------------\n\nA description of the settable variables for this role should go here, including any variables that are in defaults/main.yml, vars/main.yml, and any variables that can/should be set via parameters to the role. Any variables that are read from other roles and/or the global scope (ie. hostvars, group vars, etc.) should be mentioned here as well.\n\n\`\`\`yaml\n${pkg_list}\n\`\`\`\n\nDependencies\n------------\n\nA list of other roles hosted on Galaxy should go here, plus any details in regards to parameters that may need to be set for other roles, or variables that are used from other roles.\n\nExample Playbook\n----------------\n\nIncluding an example of how to use your role (for instance, with variables passed in as parameters) is always nice for users too:\n\n    - hosts: servers\n      roles:\n         - { role: ${author}.${roleName} }\n\nLicense\n-------\n\n${license}\n\nAuthor Information\n------------------\n\n${author}\n`;
}

// ── Per-app single-role builders ─────────────────────────────
function buildAppRoleTasks(os, app, actions) {
  const pm = pkgModule(os);
  const pkg = resolvePackageName(os, app);
  const purge = document.getElementById('purgeConfig')?.checked;
  let out = `#SPDX-License-Identifier: MIT-0\n---\n# tasks/main.yml — ${app}\n\n`;
  if (actions.includes('install')) {
    out += `- name: Install ${app}\n  ${pm}:\n    name: ${pkg}\n    state: present\n`;
    if (pm === 'apt') out += `    update_cache: yes\n`;
    out += `\n`;
  }
  if (actions.includes('start')) out += `- name: Start and enable ${app}\n  service:\n    name: ${svcName(app)}\n    state: started\n    enabled: yes\n  tags: [${app}, service]\n\n`;
  if (actions.includes('stop')) out += `- name: Stop ${app}\n  service:\n    name: ${svcName(app)}\n    state: stopped\n    enabled: no\n\n`;
  if (actions.includes('enable')) out += `- name: Enable ${app} on boot\n  service:\n    name: ${svcName(app)}\n    enabled: yes\n\n`;
  if (actions.includes('disable')) out += `- name: Disable ${app}\n  service:\n    name: ${svcName(app)}\n    enabled: no\n\n`;
  if (actions.includes('reload')) out += `- name: Reload ${app}\n  service:\n    name: ${svcName(app)}\n    state: reloaded\n  notify: Restart ${app}\n\n`;
  if (actions.includes('remove')) {
    out += `- name: Remove ${app}\n  ${pm}:\n    name: ${pkg}\n    state: absent\n`;
    if (pm === 'apt' && purge) out += `    purge: yes\n`;
    out += `\n`;
  }
  if (!out.includes('- name:')) {
    out += `- name: Confirm ${app} is ready\n  debug:\n    msg: "${app} role applied"\n`;
  }
  return out;
}

function buildAppRoleHandlers(app) {
  return `#SPDX-License-Identifier: MIT-0\n---\n# handlers/main.yml — ${app}\n\n- name: Restart ${app}\n  service:\n    name: ${svcName(app)}\n    state: restarted\n`;
}

function buildAppRoleDefaults(os, app, roleName) {
  const pkg = resolvePackageName(os, app);
  return `#SPDX-License-Identifier: MIT-0\n---\n# defaults/main.yml — ${roleName}\n\n${app}_package: "${pkg}"\n${app}_service_name: "${svcName(app)}"\n${app}_service_state: started\n${app}_service_enabled: yes\n`;
}

function buildAppRoleVars(app) {
  return `#SPDX-License-Identifier: MIT-0\n---\n# vars/main.yml — ${app}\n# High-priority variables (override defaults)\n\n# ${app}_custom_option: "value"\n`;
}

function buildAppRoleMeta(app, roleName) {
  const author = document.getElementById('roleAuthor')?.value?.trim() || 'your_name';
  const desc = document.getElementById('roleDescription')?.value?.trim() || `Ansible role for ${app}`;
  const license = document.getElementById('roleLicense')?.value || 'MIT';
  const minAns = document.getElementById('roleMinAnsible')?.value || '2.20';
  const company = document.getElementById('roleCompany')?.value?.trim() || '';
  const os = document.getElementById('os')?.value || 'ubuntu';
  const platMap = {
    ubuntu: 'Ubuntu', debian: 'Debian', redhat: 'EL', rocky: 'EL', alma: 'EL',
    oracle: 'EL', centos: 'EL', fedora: 'Fedora', amazon: 'Amazon', suse: 'SLES', opensuse: 'opensuse', alpine: 'Alpine'
  };
  const companyLine = company ? `  company: "${company}"\n` : `  # company: your company (optional)\n`;
  return `#SPDX-License-Identifier: ${license}\ngalaxy_info:\n  author: ${author}\n  description: ${desc}\n${companyLine}\n  # issue_tracker_url: http://example.com/issue/tracker\n\n  license: ${license}\n\n  min_ansible_version: "${minAns}"\n\n  platforms:\n    - name: ${platMap[os] || 'EL'}\n      versions:\n        - all\n\n  galaxy_tags:\n    - ${app}\n    - system\n\ndependencies: []\n`;
}

function buildAppRoleReadme(app, roleName, actions) {
  const author = document.getElementById('roleAuthor')?.value?.trim() || 'your_name';
  const license = document.getElementById('roleLicense')?.value || 'BSD';
  const actionList = actions.filter(a => !['sys-update', 'basic-app'].includes(a));
  const varBlock = `${app}_package: "${app}"\n${app}_service_state: started\n${app}_service_enabled: yes`;
  const actionDesc = actionList.length
    ? actionList.map(a => `- ${a} the ${app} service`).join('\n')
    : `- Manage the ${app} service`;
  return `${roleName}\n${'='.repeat(roleName.length)}\n\n${actionDesc}\n\nRequirements\n------------\n\nAny pre-requisites that may not be covered by Ansible itself or the role should be mentioned here.\n\nRole Variables\n--------------\n\nA description of the settable variables for this role should go here, including any variables that are in defaults/main.yml, vars/main.yml, and any variables that can/should be set via parameters to the role. Any variables that are read from other roles and/or the global scope (ie. hostvars, group vars, etc.) should be mentioned here as well.\n\n\`\`\`yaml\n${varBlock}\n\`\`\`\n\nDependencies\n------------\n\nA list of other roles hosted on Galaxy should go here, plus any details in regards to parameters that may need to be set for other roles, or variables that are used from other roles.\n\nExample Playbook\n----------------\n\nIncluding an example of how to use your role (for instance, with variables passed in as parameters) is always nice for users too:\n\n    - hosts: servers\n      roles:\n         - { role: ${author}.${roleName} }\n\nLicense\n-------\n\n${license}\n\nAuthor Information\n------------------\n\n${author}\n`;
}

// Build a site.yml that references all roles grouped by category
function buildZipSiteYml(roleNames, hostsVal) {
  // Group roles by category using the appCategory map
  const grouped = {};
  roleNames.forEach(({ app, roleName }) => {
    const cat = appCategory[app] || 'general';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(roleName);
  });

  const catMeta = {
    web: { hosts: 'webservers', tags: ['web'] },
    db: { hosts: 'databases', tags: ['db'] },
    devops: { hosts: 'devops', tags: ['devops'] },
    monitoring: { hosts: 'monitoring', tags: ['monitoring'] },
    security: { hosts: 'all', tags: ['security'] },
    general: { hosts: hostsVal, tags: ['all'] },
  };

  let yaml = `---\n# site.yml — Root Playbook\n# Usage: ansible-playbook -i inventory.ini site.yml\n#        ansible-playbook -i inventory.ini site.yml --tags "web"\n#        ansible-playbook -i inventory.ini site.yml --limit webservers\n\n`;

  Object.entries(grouped).forEach(([cat, roles]) => {
    const m = catMeta[cat] || catMeta.general;
    yaml += `- name: Play — ${cat} [${m.tags.join(', ')}]\n`;
    yaml += `  hosts: ${m.hosts}\n`;
    yaml += `  become: true\n`;
    yaml += `  gather_facts: true\n`;
    yaml += `  tags: [${m.tags.join(', ')}]\n`;
    yaml += `\n  roles:\n`;
    roles.forEach(r => {
      yaml += `    - role: ${r}\n`;
      yaml += `      tags: [${m.tags.join(', ')}]\n`;
    });
    yaml += `\n`;
  });
  return yaml;
}

// ── Main zip builder ─────────────────────────────────────────
window.downloadRoleZip = async function () {
  const cb = document.getElementById('galaxyRoleCheckbox');
  if (!cb?.checked) { showToast('⚠️ Enable Galaxy Role Init first', '#d97706'); return; }

  const baseRoleName = (document.getElementById('roleName')?.value?.trim() || 'my_role').replace(/\s+/g, '_');
  const desc = document.getElementById('roleDescription')?.value?.trim() || '';
  const hostsVal = document.getElementById('hostsInput')?.value?.trim() || 'all';
  const os = document.getElementById('os')?.value || 'ubuntu';
  const apps = getSelectedApps();
  const actions = [...document.querySelectorAll('.action:checked')].map(e => e.value);
  const dirs = [...document.querySelectorAll('.role-file:checked')].map(c => c.value);

  if (!baseRoleName) { showToast('⚠️ Enter a role name', '#d97706'); return; }

  const zip = new JSZip();
  const zipRoot = zip.folder(baseRoleName);

  // ── MULTI-APP: one independent role per app under roles/ ───────
  if (apps.length > 0) {
    const rolesFolder = zipRoot.folder('roles');
    const roleNameList = []; // [{app, roleName}] for site.yml

    apps.forEach(app => {
      // Role name: e.g. nginx → nginx_setup, mysql → mysql_setup
      const appSuffix = (actions.includes('remove')) ? 'remove' : 'setup';
      const roleName = `${app.replace(/-/g, '_')}_${appSuffix}`;
      roleNameList.push({ app, roleName });

      const roleDir = rolesFolder.folder(roleName);

      roleDir.file('README.md', buildAppRoleReadme(app, roleName, actions));
      if (dirs.includes('tasks')) roleDir.folder('tasks').file('main.yml', buildAppRoleTasks(os, app, actions));
      if (dirs.includes('handlers')) roleDir.folder('handlers').file('main.yml', buildAppRoleHandlers(app));
      if (dirs.includes('defaults')) roleDir.folder('defaults').file('main.yml', buildAppRoleDefaults(os, app, roleName));
      if (dirs.includes('vars')) roleDir.folder('vars').file('main.yml', buildAppRoleVars(app));
      if (dirs.includes('files')) roleDir.folder('files').file('.gitkeep', '');
      if (dirs.includes('templates')) roleDir.folder('templates').file('.gitkeep', '');
      if (dirs.includes('meta')) roleDir.folder('meta').file('main.yml', buildAppRoleMeta(app, roleName));
      if (dirs.includes('tests')) {
        const t = roleDir.folder('tests');
        t.file('inventory', `#SPDX-License-Identifier: MIT-0\nlocalhost\n`);
        t.file('test.yml', `#SPDX-License-Identifier: MIT-0\n---\n- name: Test ${roleName}\n  hosts: ${hostsVal}\n  become: true\n  roles:\n    - role: ${roleName}\n`);
      }
    });

    // Generate missing roles required by the Site Playbook (common, config_deploy, ssl_setup, etc.)
    const requiredRoles = new Set();
    document.querySelectorAll('#rootTableBody .root-roles').forEach(input => {
      if (input.value.trim()) input.value.split(',').forEach(r => requiredRoles.add(r.trim()));
    });

    // Fallback: if table empty, ensure generated roles match our siteYmlContent 
    // (though buildZipSiteYml only requires what's in roleNameList)
    const generatedRoleNames = new Set(roleNameList.map(r => r.roleName));

    requiredRoles.forEach(roleName => {
      if (!generatedRoleNames.has(roleName)) {
        generatedRoleNames.add(roleName);
        const roleDir = rolesFolder.folder(roleName);

        let customTasks = `#SPDX-License-Identifier: MIT-0\n---\n# tasks/main.yml — ${roleName}\n\n`;
        const unIndent = str => str.replace(/^  /gm, '');

        if (roleName === 'common') {
          let hasCustom = false;
          if (actions.includes('sys-update')) {
            const pm = pkgModule(os);
            if (pm === 'apt') customTasks += `- name: Update apt cache\n  apt:\n    update_cache: yes\n    cache_valid_time: 3600\n\n`;
            else if (pm === 'dnf') customTasks += `- name: Update all packages\n  dnf:\n    name: "*"\n    state: latest\n\n`;
            else if (pm === 'yum') customTasks += `- name: Update all packages\n  yum:\n    name: "*"\n    state: latest\n\n`;
            else if (pm === 'zypper') customTasks += `- name: Refresh zypper repos\n  zypper:\n    refresh: yes\n\n`;
            else if (pm === 'apk') customTasks += `- name: Update apk cache\n  apk:\n    update_cache: yes\n\n`;
            hasCustom = true;
          }
          if (actions.includes('basic-app')) {
            const pm = pkgModule(os); const pkgs = basicPkgs[os] || basicPkgs.ubuntu;
            customTasks += `- name: Install basic packages\n  ${pm}:\n    name:\n` + pkgs.map(p => `      - ${p}`).join('\n') + `\n    state: present\n` + (pm === 'apt' ? `    update_cache: yes\n` : '') + `\n`;
            hasCustom = true;
          }
          if (!hasCustom) customTasks += `- name: Ensure common tasks\n  debug:\n    msg: "common role skeleton applied"\n`;
        } else if (roleName === 'user_setup' && features.includes('user')) {
          apps.forEach(app => customTasks += unIndent(userTask(app)));
        } else if (roleName === 'config_deploy' && features.includes('config')) {
          const configContent = document.getElementById('configEditor')?.value || '';
          if (apps.length === 0 && configContent) {
            const ind = configContent.split('\n').map(l => '      ' + l).join('\n');
            customTasks += `- name: Apply general configuration\n  copy:\n    content: |\n${ind}\n    dest: /etc/app.conf\n    owner: root\n    group: root\n    mode: '0644'\n\n`;
          } else if (configContent) {
            apps.forEach(app => customTasks += unIndent(configTask(app, configContent)));
          }
        } else if (roleName === 'ssl_setup' && features.includes('ssl')) {
          apps.forEach(app => customTasks += unIndent(sslTask(app)));
        } else if (roleName === 'firewall_setup' && features.includes('enableFirewall')) {
          customTasks += unIndent(firewallTasks());
        } else {
          customTasks += `- name: Placeholder for ${roleName}\n  debug:\n    msg: "Replace this with actual tasks for ${roleName}"\n`;
        }

        roleDir.file('README.md', `# ${roleName}\n\nAuto-generated skeleton role for ${roleName}.\n`);
        if (dirs.includes('tasks')) roleDir.folder('tasks').file('main.yml', customTasks);
        if (dirs.includes('handlers')) roleDir.folder('handlers').file('main.yml', `#SPDX-License-Identifier: MIT-0\n---\n# handlers/main.yml\n`);
        if (dirs.includes('defaults')) roleDir.folder('defaults').file('main.yml', `#SPDX-License-Identifier: MIT-0\n---\n# defaults/main.yml\n`);
        if (dirs.includes('vars')) roleDir.folder('vars').file('main.yml', `#SPDX-License-Identifier: MIT-0\n---\n# vars/main.yml\n`);
        if (dirs.includes('meta')) roleDir.folder('meta').file('main.yml', buildAppRoleMeta(roleName, roleName));
      }
    });

    // site.yml at project root (next to roles/)
    const siteYmlContent = (document.querySelectorAll('#rootTableBody tr').length > 0) ? generateSiteYAML() : buildZipSiteYml(roleNameList, hostsVal);
    zipRoot.file('site.yml', siteYmlContent);

    // ansible.cfg pointing roles_path to ./roles
    zipRoot.file('ansible.cfg', generateAnsibleCfg());

    // inventory.ini stub
    zipRoot.file('inventory.ini', generateInventoryINI());

    // Project-level README
    const roleListMd = roleNameList.map(r => `- \`roles/${r.roleName}\` — manages **${r.app}**`).join('\n');
    zipRoot.file('README.md',
      `# ${baseRoleName}\n\nGenerated by [Ansible YAML Generator](https://harishnshetty.github.io/tools/an/)\n\n## Roles\n${roleListMd}\n\n## Usage\n\`\`\`bash\n# Run everything\nansible-playbook -i inventory.ini site.yml\n\n# Run only web roles\nansible-playbook -i inventory.ini site.yml --tags web\n\n# Limit to a host group\nansible-playbook -i inventory.ini site.yml --limit databases\n\`\`\`\n`);

  } else {
    // ── SINGLE / NO-APP: legacy flat role layout ────────────────
    zipRoot.file('README.md', buildRoleReadme(baseRoleName, desc, apps));
    if (dirs.includes('tasks')) zipRoot.folder('tasks').file('main.yml', buildRoleTasks(os, apps, actions));
    if (dirs.includes('handlers')) zipRoot.folder('handlers').file('main.yml', buildRoleHandlers(apps));
    if (dirs.includes('defaults')) zipRoot.folder('defaults').file('main.yml', buildRoleDefaults(os, apps));
    if (dirs.includes('vars')) zipRoot.folder('vars').file('main.yml', buildRoleVars(apps));
    if (dirs.includes('files')) zipRoot.folder('files').file('.gitkeep', '');
    if (dirs.includes('templates')) zipRoot.folder('templates').file('.gitkeep', '');
    if (dirs.includes('meta')) zipRoot.folder('meta').file('main.yml', buildRoleMeta(apps));
    if (dirs.includes('tests')) {
      const t = zipRoot.folder('tests');
      t.file('inventory', `#SPDX-License-Identifier: MIT-0\nlocalhost\n`);
      t.file('test.yml', `#SPDX-License-Identifier: MIT-0\n---\n- name: Test ${baseRoleName}\n  hosts: ${hostsVal}\n  become: true\n  roles:\n    - role: ${baseRoleName}\n`);
    }
    // Still include a site.yml
    zipRoot.file('site.yml',
      `---\n# site.yml\n- name: Play — ${hostsVal}\n  hosts: ${hostsVal}\n  become: true\n  gather_facts: true\n\n  roles:\n    - role: ${baseRoleName}\n`);
  }

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${baseRoleName}.zip`;
  a.click();
  showToast(`📦 ${baseRoleName}.zip downloaded!`, '#7c3aed');
};

// ══════════════════════════════════════════════════════════════
//  INVENTORY GENERATOR
// ══════════════════════════════════════════════════════════════

// Seed default rows on load
document.addEventListener('DOMContentLoaded', () => {
  // Inventory default rows (pre-populated from user CSV pattern)
  const defaultInvRows = [
    { group: 'dev-env', ip: '10.0.1.10', alias: 'dev-web-01', extra: '' },
    { group: 'dev-env', ip: '10.0.1.11', alias: 'dev-db-01', extra: '' },
    { group: 'prod-env', ip: '10.0.2.10', alias: 'prod-web-01', extra: '' },
    { group: 'prod-env', ip: '10.0.2.11', alias: 'prod-db-01', extra: '' },
    { group: 'nginx-node', ip: '10.0.3.10', alias: 'nginx-01', extra: 'ansible_user=ubuntu' },
  ];
  defaultInvRows.forEach(r => addInvRow(r.group, r.ip, r.alias, r.extra));

  // Root playbook default rows
  const defaultRootRows = [
    { hosts: 'all', roles: 'common, security', tags: 'base', become: 'yes', when: '' },
    { hosts: 'webservers', roles: 'nginx_setup, ssl_setup', tags: 'web, ssl', become: 'yes', when: '' },
    { hosts: 'databases', roles: 'mysql_setup', tags: 'db', become: 'yes', when: '' },
    { hosts: 'monitoring', roles: 'prometheus, grafana', tags: 'monitor', become: 'yes', when: "inventory_hostname in groups['monitoring']" },
  ];
  defaultRootRows.forEach(r => addRootRow(r.hosts, r.roles, r.tags, r.become, r.when));
});

// ── Inventory table helpers ───────────────────────────────────
let _invGroupCounter = 0;

window.addInvRow = function (group = '', ip = '', alias = '', extra = '') {
  const tbody = document.getElementById('invTableBody');
  if (!tbody) return;
  const tr = document.createElement('tr');
  tr.className = 'border-b border-gray-100';
  tr.innerHTML = `
    <td class="p-1 border border-gray-200">
      <input type="text" class="form-input inv-group text-xs" value="${group}" placeholder="webservers" />
    </td>
    <td class="p-1 border border-gray-200">
      <input type="text" class="form-input inv-ip text-xs font-mono" value="${ip}" placeholder="192.168.1.10" />
    </td>
    <td class="p-1 border border-gray-200">
      <input type="text" class="form-input inv-alias text-xs" value="${alias}" placeholder="web-01" />
    </td>
    <td class="p-1 border border-gray-200">
      <input type="text" class="form-input inv-extra text-xs font-mono" value="${extra}" placeholder="key=value" />
    </td>
    <td class="p-1 border border-gray-200 text-center">
      <button onclick="this.closest('tr').remove()" class="text-red-500 hover:text-red-700 font-bold text-sm">✕</button>
    </td>`;
  tbody.appendChild(tr);
};

window.addInvGroup = function () {
  _invGroupCounter++;
  addInvRow(`group_${_invGroupCounter}`, '', '', '');
};

function getInvRows() {
  const rows = [];
  document.querySelectorAll('#invTableBody tr').forEach(tr => {
    const g = tr.querySelector('.inv-group')?.value.trim();
    const ip = tr.querySelector('.inv-ip')?.value.trim();
    const alias = tr.querySelector('.inv-alias')?.value.trim();
    const extra = tr.querySelector('.inv-extra')?.value.trim();
    if (ip) rows.push({ group: g || 'ungrouped', ip, alias, extra });
  });
  return rows;
}

window.generateInventoryINI = function () {
  const user = document.getElementById('invUser')?.value.trim() || 'ubuntu';
  const port = document.getElementById('invPort')?.value.trim() || '22';
  const conn = document.getElementById('invConn')?.value || 'ssh';
  const privKey = document.getElementById('invPrivKey')?.value.trim() || '~/.ssh/id_rsa';
  const rows = getInvRows();

  // Group hosts
  const groups = {};
  rows.forEach(r => {
    if (!groups[r.group]) groups[r.group] = [];
    groups[r.group].push(r);
  });

  let ini = `# inventory.ini — generated by Ansible YAML Generator\n# Run: ansible-playbook -i inventory.ini site.yml\n\n`;

  Object.entries(groups).forEach(([grp, hosts]) => {
    ini += `[${grp}]\n`;
    hosts.forEach(h => {
      let line = h.alias ? `${h.alias} ansible_host=${h.ip}` : h.ip;
      if (h.extra) line += ` ${h.extra}`;
      ini += line + '\n';
    });
    ini += '\n';
  });

  // Group of groups
  if (Object.keys(groups).length > 1) {
    ini += `[all_groups:children]\n`;
    Object.keys(groups).forEach(g => { ini += `${g}\n`; });
    ini += '\n';
  }

  // Global vars
  ini += `[all:vars]\n`;
  ini += `ansible_user=${user}\n`;
  ini += `ansible_port=${port}\n`;
  ini += `ansible_connection=${conn}\n`;
  ini += `ansible_ssh_private_key_file=${privKey}\n`;
  ini += `ansible_python_interpreter=/usr/bin/python3\n`;
  ini += `ansible_ssh_common_args='-o StrictHostKeyChecking=no'\n`;

  const out = document.getElementById('invOutput');
  out.textContent = ini;
  out.classList.remove('hidden');
  return ini;
};

window.downloadInventoryINI = function () {
  const ini = generateInventoryINI();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([ini], { type: 'text/plain' }));
  a.download = 'inventory.ini'; a.click();
  showToast('⬇️ inventory.ini downloaded!');
};

window.downloadInventoryCSV = function () {
  const rows = getInvRows();
  const user = document.getElementById('invUser')?.value.trim() || 'ubuntu';
  const port = document.getElementById('invPort')?.value.trim() || '22';
  const privKey = document.getElementById('invPrivKey')?.value.trim() || '~/.ssh/id_rsa';

  let csv = 'Group,Host/IP,Alias,ansible_user,ansible_port,ansible_ssh_private_key_file,Extra Vars\n';
  if (rows.length) {
    rows.forEach(r => { csv += `"${r.group}","${r.ip}","${r.alias}","${user}","${port}","${privKey}","${r.extra}"\n`; });
  } else {
    // Template rows
    ['dev-env', 'prod-env', 'nginx-node'].forEach(g => {
      for (let i = 1; i <= 3; i++) {
        csv += `"${g}","10.0.0.${i}","${g}-0${i}","${user}","${port}","${privKey}",""\n`;
      }
    });
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = 'inventory.csv'; a.click();
  showToast('📄 inventory.csv downloaded!', '#d97706');
};

// ── CSV Upload → repopulate table ─────────────────────────────
window.uploadInventoryCSV = function (event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    const text = e.target.result;
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) { showToast('⚠️ CSV is empty or has no data rows', '#d97706'); return; }

    // Parse header to find column indices (case-insensitive)
    const parseCSVLine = line => {
      const result = [];
      let cur = '', inQ = false;
      for (const ch of line) {
        if (ch === '"') { inQ = !inQ; }
        else if (ch === ',' && !inQ) { result.push(cur.trim()); cur = ''; }
        else cur += ch;
      }
      result.push(cur.trim());
      return result;
    };

    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z_]/g, ''));
    const idx = k => headers.indexOf(k);

    const iGroup = idx('group');
    const iIP = idx('hostip');        // "Host/IP" → "hostip"
    const iAlias = idx('alias');
    const iUser = idx('ansible_user');
    const iPort = idx('ansible_port');
    const iKey = idx('ansible_ssh_private_key_file');
    const iExtra = idx('extravars');     // "Extra Vars" → "extravars"

    // Clear existing rows
    const tbody = document.getElementById('invTableBody');
    if (tbody) tbody.innerHTML = '';

    let loadedUser = '', loadedPort = '', loadedKey = '';
    let count = 0;

    lines.slice(1).forEach(line => {
      if (!line) return;
      const cols = parseCSVLine(line);
      const group = iGroup >= 0 ? cols[iGroup] || '' : '';
      const ip = iIP >= 0 ? cols[iIP] || '' : cols[1] || '';
      const alias = iAlias >= 0 ? cols[iAlias] || '' : '';
      const extra = iExtra >= 0 ? cols[iExtra] || '' : '';

      if (!ip && !group) return; // skip blank rows

      // Capture global connection values from first data row
      if (!loadedUser && iUser >= 0) loadedUser = cols[iUser] || '';
      if (!loadedPort && iPort >= 0) loadedPort = cols[iPort] || '';
      if (!loadedKey && iKey >= 0) loadedKey = cols[iKey] || '';

      addInvRow(group, ip, alias, extra);
      count++;
    });

    // Apply global connection values back to the form fields
    if (loadedUser) { const el = document.getElementById('invUser'); if (el) el.value = loadedUser; }
    if (loadedPort) { const el = document.getElementById('invPort'); if (el) el.value = loadedPort; }
    if (loadedKey) { const el = document.getElementById('invPrivKey'); if (el) el.value = loadedKey; }

    // Reset file input so same file can be re-uploaded
    event.target.value = '';

    showToast(`✅ Loaded ${count} host${count !== 1 ? 's' : ''} from CSV!`);
  };
  reader.readAsText(file);
};

// ══════════════════════════════════════════════════════════════
//  ROOT PLAYBOOK — site.yml
// ══════════════════════════════════════════════════════════════

// ── App-category mappings for Root Playbook sync ─────────────────
const appCategory = {
  // Web
  nginx: 'web', apache2: 'web', httpd: 'web',
  haproxy: 'web', traefik: 'web', caddy: 'web', keepalived: 'web',
  // Databases
  mysql: 'db', mariadb: 'db', postgresql: 'db', mongodb: 'db', redis: 'db',
  // DevOps / CI-CD
  docker: 'devops', git: 'devops', jenkins: 'devops', ansible: 'devops',
  terraform: 'devops', sonarqube: 'devops', nexus: 'devops',
  packer: 'devops', pulumi: 'devops', nomad: 'devops',
  // Monitoring
  prometheus: 'monitoring', grafana: 'monitoring', node_exporter: 'monitoring',
  alertmanager: 'monitoring', 'zabbix-agent': 'monitoring',
  elasticsearch: 'monitoring', kibana: 'monitoring', logstash: 'monitoring',
  // Security
  vault: 'security', consul: 'security', fail2ban: 'security', clamav: 'security',
  trivy: 'security', falco: 'security', certbot: 'security',
  // Kubernetes
  kubectl: 'kubernetes', helm: 'kubernetes', eksctl: 'kubernetes',
  k9s: 'kubernetes', minikube: 'kubernetes', kind: 'kubernetes',
  kustomize: 'kubernetes', argocd: 'kubernetes', fluxcd: 'kubernetes',
  // Cloud CLI
  'aws-cli': 'cloud', 'azure-cli': 'cloud', gcloud: 'cloud',
};
const categoryMeta = {
  web: { hosts: 'webservers', tag: 'web' },
  db: { hosts: 'databases', tag: 'db' },
  devops: { hosts: 'devops', tag: 'devops' },
  monitoring: { hosts: 'monitoring', tag: 'monitoring' },
  security: { hosts: 'all', tag: 'security' },
  kubernetes: { hosts: 'k8s_nodes', tag: 'kubernetes' },
  cloud: { hosts: 'all', tag: 'cloud' },
  iac: { hosts: 'devops', tag: 'iac' },
};

// Build a canonical role name from an app name + selected actions/features
function deriveRoleName(app, actions, features) {
  const app_ = app.replace(/-/g, '_');
  if (actions.includes('install') || actions.includes('start') || actions.includes('enable')) {
    return `${app_}_setup`;
  }
  if (actions.includes('remove')) return `${app_}_remove`;
  if (features.includes('config')) return `${app_}_config`;
  return `${app_}_role`;
}

// Sync Root Playbook table from currently selected apps / actions / features
window.syncRootFromSelections = function () {
  const apps = getSelectedApps();
  const actions = [...document.querySelectorAll('.action:checked')].map(e => e.value);
  const features = [...document.querySelectorAll('.feature:checked')].map(e => e.value);
  let hostsVal = document.getElementById('hostsInput')?.value?.trim() || 'all';

  // Read available groups from the inventory table
  const inventoryGroups = [...new Set(
    [...document.querySelectorAll('#invTableBody .inv-group')]
      .map(i => i.value.trim()).filter(v => v && v !== 'ungrouped')
  )];
  const getGroup = (type) => {
    if (inventoryGroups.length === 0) return categoryMeta[type]?.hosts || 'all';
    if (type === 'web') return inventoryGroups[0];
    if (type === 'db') return inventoryGroups[1] || inventoryGroups[0];
    if (type === 'devops' || type === 'monitoring') return inventoryGroups[2] || inventoryGroups[inventoryGroups.length - 1];
    return hostsVal;
  };

  // Clear existing rows
  const tbody = document.getElementById('rootTableBody');
  if (tbody) tbody.innerHTML = '';

  // ── 1. Common play for sys-update / basic-app ─────────────────────
  const sysActions = [];
  if (actions.includes('sys-update')) sysActions.push('update');
  if (actions.includes('basic-app')) sysActions.push('packages');
  if (sysActions.length) {
    addRootRow(hostsVal, 'common', sysActions.join(', '), 'yes', '');
  }

  // ── 2. One play per app-category ─────────────────────────────────
  const grouped = {}; // category → [roleName]
  apps.forEach(app => {
    const cat = appCategory[app] || 'general';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(deriveRoleName(app, actions, features));
  });

  // Feature-derived extra roles to append to each group
  const featureRoles = [];
  if (features.includes('config')) featureRoles.push('config_deploy');
  if (features.includes('ssl')) featureRoles.push('ssl_setup');
  if (features.includes('enableFirewall')) featureRoles.push('firewall_setup');
  if (features.includes('user')) featureRoles.push('user_setup');

  Object.entries(grouped).forEach(([cat, roleList]) => {
    const meta = Object.assign({}, categoryMeta[cat] || { hosts: 'all', tag: cat });
    meta.hosts = getGroup(cat);

    const allRoles = [...roleList, ...featureRoles];
    const tags = [meta.tag, ...actions.filter(a => !['sys-update', 'basic-app'].includes(a))];
    addRootRow(meta.hosts, allRoles.join(', '), [...new Set(tags)].join(', '), 'yes', '');
  });

  // ── 3. Fallback: if no apps selected but features chosen ──────────
  if (!apps.length && featureRoles.length) {
    addRootRow(hostsVal, featureRoles.join(', '), features.join(', '), 'yes', '');
  }

  if (!tbody.children.length) {
    showToast('⚠️ Select apps / actions first', '#d97706');
  } else {
    showToast(`✅ ${tbody.children.length} play${tbody.children.length > 1 ? 's' : ''} synced from selections!`);
  }
};

window.addRootRow = function (hosts = 'all', roles = '', tags = '', become = 'yes', when = '') {
  const tbody = document.getElementById('rootTableBody');
  if (!tbody) return;
  const tr = document.createElement('tr');
  tr.className = 'border-b border-gray-100';
  tr.innerHTML = `
    <td class="p-1 border border-gray-200">
      <input type="text" class="form-input root-hosts text-xs" value="${hosts}" placeholder="webservers" />
    </td>
    <td class="p-1 border border-gray-200">
      <input type="text" class="form-input root-roles text-xs font-mono" value="${roles}" placeholder="nginx_setup, php_setup" />
    </td>
    <td class="p-1 border border-gray-200">
      <input type="text" class="form-input root-tags text-xs" value="${tags}" placeholder="web" />
    </td>
    <td class="p-1 border border-gray-200">
      <select class="form-select root-become text-xs">
        <option ${become === 'yes' ? 'selected' : ''}>yes</option>
        <option ${become === 'no' ? 'selected' : ''}>no</option>
      </select>
    </td>
    <td class="p-1 border border-gray-200">
      <input type="text" class="form-input root-when text-xs font-mono" value="${when}" placeholder="optional" />
    </td>
    <td class="p-1 border border-gray-200 text-center">
      <button onclick="this.closest('tr').remove()" class="text-red-500 hover:text-red-700 font-bold text-sm">✕</button>
    </td>`;
  tbody.appendChild(tr);
};

window.generateSiteYAML = function () {
  const rows = document.querySelectorAll('#rootTableBody tr');
  if (!rows.length) {
    showToast('⚠️ No plays — use Sync or add a row first', '#d97706');
    return '';
  }

  let yaml = `---\n# site.yml — Root Playbook\n# Generated by Ansible YAML Generator\n# Usage: ansible-playbook -i inventory.ini site.yml\n#        ansible-playbook -i inventory.ini site.yml --tags "web,db"\n#        ansible-playbook -i inventory.ini site.yml --limit webservers\n\n`;

  rows.forEach(tr => {
    const hosts = tr.querySelector('.root-hosts')?.value.trim() || 'all';
    const roles = tr.querySelector('.root-roles')?.value.trim() || '';
    const tags = tr.querySelector('.root-tags')?.value.trim() || '';
    const become = tr.querySelector('.root-become')?.value || 'yes';
    const when = tr.querySelector('.root-when')?.value.trim() || '';

    if (!roles) return;
    const roleList = roles.split(',').map(r => r.trim()).filter(Boolean);
    const tagList = tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];

    yaml += `- name: Play — ${hosts} [${tagList.join(', ') || 'all'}]\n`;
    yaml += `  hosts: ${hosts}\n`;
    yaml += `  become: ${become}\n`;
    yaml += `  gather_facts: true\n`;
    if (when) yaml += `  when: ${when}\n`;
    if (tagList.length) yaml += `  tags: [${tagList.join(', ')}]\n`;
    yaml += `\n  roles:\n`;
    roleList.forEach(role => {
      yaml += `    - role: ${role}\n`;
      if (tagList.length) yaml += `      tags: [${tagList.join(', ')}]\n`;
    });
    yaml += '\n';
  });

  const out = document.getElementById('rootOutput');
  out.innerHTML = syntaxHighlight(yaml);
  out.classList.remove('hidden');
  // store raw for download/copy
  out.dataset.raw = yaml;
  return yaml;
};

window.downloadSiteYAML = function () {
  const out = document.getElementById('rootOutput');
  const yaml = (out?.dataset.raw) || generateSiteYAML();
  if (!yaml) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([yaml], { type: 'text/yaml' }));
  a.download = 'site.yml'; a.click();
  showToast('⬇️ site.yml downloaded!');
};

window.copySiteYAML = function () {
  const out = document.getElementById('rootOutput');
  const text = out?.dataset.raw || out?.innerText;
  if (!text) { showToast('⚠️ Generate first', '#d97706'); return; }
  navigator.clipboard.writeText(text).then(() => showToast('✅ site.yml copied!'));
};

// ══════════════════════════════════════════════════════════════
//  ANSIBLE.CFG GENERATOR
// ══════════════════════════════════════════════════════════════

window.generateAnsibleCfg = function () {
  const inventory = document.getElementById('cfgInventory')?.value.trim() || 'inventory.ini';
  const user = document.getElementById('cfgUser')?.value.trim() || 'ubuntu';
  const privKey = document.getElementById('cfgPrivKey')?.value.trim() || '~/.ssh/id_rsa';
  const rolesPath = document.getElementById('cfgRolesPath')?.value.trim() || 'roles';
  const forks = document.getElementById('cfgForks')?.value || '10';
  const hostKey = document.getElementById('cfgHostKeyCheck')?.checked;
  const retry = document.getElementById('cfgRetry')?.checked;

  const cfg = `# ansible.cfg — generated by Ansible YAML Generator
# Place this file in your project root or ~/.ansible.cfg

[defaults]
inventory              = ${inventory}
remote_user            = ${user}
private_key_file       = ${privKey}
roles_path             = ${rolesPath}
forks                  = ${forks}
host_key_checking      = ${hostKey ? 'True' : 'False'}
retry_files_enabled    = ${retry ? 'True' : 'False'}
stdout_callback        = default
callbacks_enabled      = profile_tasks
interpreter_python     = auto_silent
gathering              = smart

[privilege_escalation]
become                 = True
become_method          = sudo
become_user            = root
become_ask_pass        = False

[ssh_connection]
ssh_args               = -o ControlMaster=auto -o ControlPersist=60s -o StrictHostKeyChecking=no
pipelining             = True
control_path           = /tmp/ansible-ssh-%%h-%%p-%%r
`;

  const out = document.getElementById('cfgOutput');
  out.textContent = cfg;
  out.classList.remove('hidden');
  return cfg;
};

window.downloadAnsibleCfg = function () {
  const cfg = generateAnsibleCfg();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([cfg], { type: 'text/plain' }));
  a.download = 'ansible.cfg'; a.click();
  showToast('⬇️ ansible.cfg downloaded!');
};
