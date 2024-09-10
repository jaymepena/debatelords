 <a id="readme-top"></a>

<!-- PROJECT LOGO -->
<br />
<div align="center">
  <a href="https://github.com/jaymepena/debatelords">
    <img src="public/images/debatelords-logo.svg" alt="Logo" width="500" height="80">
  </a>

<h3 align="center">DEBATELORDS CONTROLLER</h3>

  <p align="center">
    How do I do dis?
  </p>
</div>


<!-- ABOUT THE PROJECT -->
## About

Talent will press the button, the things will update, the world will keep spinning.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- GETTING STARTED -->
## Getting Started

### Prerequisites

- NodeJS (20.0+)
- npm
- IIS running on Windows 10/11
- A sense of self worth

### Installation

1. Update the .env file to the server PC's IP address (or leave LocalHost for demo)
2. Install NPM packages
   ```sh
   npm install
   ```
2.5 - ENV file is in the design drive under 2024/Twitch/TCSD/.env
3. Install IIS (see Below)
4. Run!
   ```sh
   node server.js
   ```
5. Open <a>localhost:3000</a> in a web browser

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- IIS GUIDE -->
# IIS GUIDE 
### Installation

Browse to Control Panel -> Programs and Features

1. Open the "Turn Windows Features On or Off" dialogue box
2. Select "Internet Information Services" and "Internet Information Services Hostable Web Core" and ensure it is checked
3. Hit ok
4. Make yourself another coffee or tea
5. Its done! Panel should now be accessible at [yourip]:3000

<p align="right">(<a href="#readme-top">back to top</a>)</p>
