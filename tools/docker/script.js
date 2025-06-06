// Copy playbook text to clipboard
function copyToClipboard() {
  const output = document.getElementById('output');
  if (!output) {
    alert('Output area not found!');
    return;
  }
  output.select();
  output.setSelectionRange(0, 99999);

  navigator.clipboard.writeText(output.value).then(() => {
    alert('Playbook copied to clipboard!');
  }).catch(() => {
    alert('Failed to copy, please copy manually.');
  });
}

function generateDockerCLI() {
  const action = document.getElementById("dockerAction")?.value;

  if (!action) {
    alert("Please select a Docker CLI action.");
    return;
  }

  const imageName = document.getElementById("dockerImage")?.value || "my-image";
  const containerName = document.getElementById("dockerContainer")?.value || "my-container";

  let command = "";

  switch (action) {
    case "build":
      command = `docker build -t ${imageName} .`;
      break;
    case "remove":
      command = `docker rm -f ${containerName}`;
      break;
    case "cleanup":
      command = `docker image prune -f`;
      break;
    case "run":
      command = `docker run -d --name ${containerName}`;

      if (document.getElementById("dockerNet")?.checked) {
        const net = document.getElementById("dockerNetValue")?.value;
        if (net) command += ` --net ${net}`;
      }
      if (document.getElementById("dockerIP")?.checked) {
        const ip = document.getElementById("dockerIPValue")?.value;
        if (ip) command += ` --ip ${ip}`;
      }
      if (document.getElementById("dockerPort")?.checked) {
        const port = document.getElementById("dockerPortValue")?.value;
        if (port) command += ` -p ${port}`;
      }

      command += ` ${imageName}`;
      break;
    default:
      alert("Unknown Docker action selected.");
      return;
  }

  const output = document.getElementById("output");
  if (output) {
    output.value = command;
  } else {
    alert("Output field not found!");
  }
}

// Generate playbook YAML based on selected options
function generatePlaybook() {
- const osSelect = document.getElementById('osSelect');
- const appSelect = document.getElementById('appSelect');
+ const osSelect = document.getElementById('os');
+ const appSelect = document.getElementById('app');

  
  if (!osSelect || !appSelect) {
    alert('OS or Application select not found!');
    return;
  }

  const os = osSelect.value;
  const app = appSelect.value;

  // Determine package manager based on OS
  let pkgManager = 'apt';
  if (os === 'amazon') pkgManager = 'yum';
  else if (os === 'redhat') pkgManager = 'dnf';

  let tasks = [];

  // Add YAML header comments
  tasks.push(`# Target OS: ${os}`);
  tasks.push(`# Selected Application: ${app}`);

if (document.getElementById('createUser')?.checked) {
  tasks.push(getUserCreationTask(app));
}


  // App-specific tasks
  if (app === 'nginx') {
    if (document.getElementById('installNginx')?.checked) {
      tasks.push(`- name: Ensure Nginx is installed
  ${pkgManager}:
    name: nginx
    state: present
    update_cache: yes`);
    }
    if (document.getElementById('startNginx')?.checked) {
      tasks.push(`- name: Ensure Nginx is running
  service:
    name: nginx
    state: started
    enabled: yes`);
    }
    if (document.getElementById('stopNginx')?.checked) {
      tasks.push(`- name: Stop Nginx service
  service:
    name: nginx
    state: stopped
    enabled: no`);
    }
    if (document.getElementById('uninstallNginx')?.checked) {
      tasks.push(`- name: Uninstall Nginx
  ${pkgManager}:
    name: nginx
    state: absent`);
    }
    if (document.getElementById('createWebDir')?.checked) {
      tasks.push(`- name: Create web directory
  file:
    path: /var/www/html
    state: directory
    owner: www-data
    group: www-data
    mode: '0755'`);
    }
    if (document.getElementById('copyIndex')?.checked) {
      tasks.push(`- name: Copy index.html
  copy:
    src: index.html
    dest: /var/www/html/index.html
    owner: www-data
    group: www-data
    mode: '0644'`);
    }
  }

  if (app === 'tomcat') {
    if (document.getElementById('installTomcat')?.checked) {
      tasks.push(`- name: Install Tomcat
  ${pkgManager}:
    name: tomcat9
    state: present`);
    }
    if (document.getElementById('startTomcat')?.checked) {
      tasks.push(`- name: Start Tomcat service
  service:
    name: tomcat9
    state: started
    enabled: yes`);
    }
    if (document.getElementById('stopTomcat')?.checked) {
      tasks.push(`- name: Stop Tomcat service
  service:
    name: tomcat9
    state: stopped
    enabled: no`);
    }
    if (document.getElementById('uninstallTomcat')?.checked) {
      tasks.push(`- name: Uninstall Tomcat
  ${pkgManager}:
    name: tomcat9
    state: absent`);
    }
    if (document.getElementById('configureTomcat')?.checked) {
      tasks.push(`- name: Configure Tomcat
  template:
    src: tomcat.conf.j2
    dest: /etc/tomcat9/server.xml`);
    }
  }

  if (app === 'httpd') {
    if (document.getElementById('installHttpd')?.checked) {
      tasks.push(`- name: Install HTTPD
  ${pkgManager}:
    name: httpd
    state: present`);
    }
    if (document.getElementById('startHttpd')?.checked) {
      tasks.push(`- name: Start HTTPD service
  service:
    name: httpd
    state: started
    enabled: yes`);
    }
    if (document.getElementById('stopHttpd')?.checked) {
      tasks.push(`- name: Stop HTTPD service
  service:
    name: httpd
    state: stopped
    enabled: no`);
    }
    if (document.getElementById('uninstallHttpd')?.checked) {
      tasks.push(`- name: Uninstall HTTPD
  ${pkgManager}:
    name: httpd
    state: absent`);
    }
  }

  if (app === 'lamp') {
    if (document.getElementById('installLamp')?.checked) {
      tasks.push(`- name: Install Apache, MySQL and PHP
  ${pkgManager}:
    name:
      - apache2
      - mysql-server
      - php
    state: present
    update_cache: yes`);
    }
    if (document.getElementById('startLamp')?.checked) {
      tasks.push(`- name: Start Apache service
  service:
    name: apache2
    state: started
    enabled: yes

- name: Start MySQL service
  service:
    name: mysql
    state: started
    enabled: yes`);
    }
    if (document.getElementById('stopLamp')?.checked) {
      tasks.push(`- name: Stop Apache service
  service:
    name: apache2
    state: stopped
    enabled: no

- name: Stop MySQL service
  service:
    name: mysql
    state: stopped
    enabled: no`);
    }
    if (document.getElementById('uninstallLamp')?.checked) {
      tasks.push(`- name: Uninstall Apache, MySQL and PHP
  ${pkgManager}:
    name:
      - apache2
      - mysql-server
      - php
    state: absent`);
    }
  }
function getUserCreationTask(app) {
  const users = {
    nginx: { name: 'www-data', home: '/var/www', group: 'www-data' },
    httpd: { name: 'apache', home: '/var/www', group: 'apache' },
    apache2: { name: 'www-data', home: '/var/www', group: 'www-data' },
    mysql: { name: 'mysql', home: '/var/lib/mysql', group: 'mysql' },
    mariadb: { name: 'mariadb', home: '/var/lib/mariadb', group: 'mariadb' },
    mongodb: { name: 'mongodb', home: '/var/lib/mongodb', group: 'mongodb' },
    nodejs: { name: 'nodeapp', home: '/home/nodeapp', group: 'nodeapp' },
    maven: { name: 'developer', home: '/home/developer', group: 'developer' },
    openjdk11: { name: 'developer', home: '/home/developer', group: 'developer' },
    openjdk17: { name: 'developer', home: '/home/developer', group: 'developer' },
    openjdk21: { name: 'developer', home: '/home/developer', group: 'developer' }
  };

  const u = users[app] || { name: 'webadmin', home: '/home/webadmin', group: 'webadmin' };

  return `  - name: Create ${u.name} user\n    user:\n      name: ${u.name}\n      group: ${u.group}\n      home: ${u.home}\n      state: present\n      create_home: yes\n\n`;
}


  // Compose final playbook YAML
  const playbook = `- name: Auto-generated playbook for ${os} - ${app}
  hosts: localhost
  become: yes
  tasks:
${tasks.map(t => '  ' + t.replace(/\n/g, '\n  ')).join('\n\n')}`;

  const output = document.getElementById('output');
  if (output) {
    output.value = playbook;
  } else {
    alert('Output textarea not found!');
  }
}

// Initialize app options visibility on page load
window.onload = () => {
  toggleAppOptions();

  const appSelect = document.getElementById('appSelect');
  if (appSelect) {
    appSelect.addEventListener('change', toggleAppOptions);
  }

  const generateBtn = document.getElementById('generateBtn');
  if (generateBtn) {
    generateBtn.addEventListener('click', generatePlaybook);
  }

  const copyBtn = document.getElementById('copyBtn');
  if (copyBtn) {
    copyBtn.addEventListener('click', copyToClipboard);
  }
};


