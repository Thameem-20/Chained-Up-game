class Game {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        document.body.appendChild(this.renderer.domElement);

        // Initialize socket first
        this.setupMultiplayer();

        // Add skybox
        this.createSkybox();

        // Enhanced lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        
        directionalLight.position.set(50, 100, 50);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 500;
        directionalLight.shadow.camera.left = -100;
        directionalLight.shadow.camera.right = 100;
        directionalLight.shadow.camera.top = 100;
        directionalLight.shadow.camera.bottom = -100;
        this.scene.add(directionalLight);

        // Add point lights for atmosphere
        const pointLight1 = new THREE.PointLight(0x4444ff, 1, 100);
        pointLight1.position.set(50, 20, 50);
        this.scene.add(pointLight1);

        const pointLight2 = new THREE.PointLight(0xff4444, 1, 100);
        pointLight2.position.set(-50, 20, -50);
        this.scene.add(pointLight2);

        // Enhanced ground with texture
        const textureLoader = new THREE.TextureLoader();
        const groundTexture = textureLoader.load('https://threejs.org/examples/textures/terrain/grasslight-big.jpg');
        groundTexture.wrapS = groundTexture.wrapT = THREE.RepeatWrapping;
        groundTexture.repeat.set(100, 100);
        groundTexture.anisotropy = 16;

        const groundGeometry = new THREE.PlaneGeometry(200, 200);
        const groundMaterial = new THREE.MeshStandardMaterial({ 
            map: groundTexture,
            side: THREE.DoubleSide,
            roughness: 0.8,
            metalness: 0.2
        });
        this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
        this.ground.rotation.x = -Math.PI / 2;
        this.ground.receiveShadow = true;
        this.scene.add(this.ground);

        // Add decorative elements
        this.createDecorations();

        // Add platforms after ground setup
        this.platforms = [];
        this.createPlatforms();

        // Player setup
        this.player = null;
        this.otherPlayer = null;
        this.rope = null;

        // Physics properties
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.isJumping = false;
        this.gravity = 0.08;
        this.jumpForce = 0.8;
        this.playerHeight = 1;
        this.maxRopeLength = 5;

        // Camera setup
        this.camera.position.set(0, 5, 10);
        this.mouseSensitivity = 0.002;
        this.cameraRotation = new THREE.Euler(0, 0, 0, 'YXZ');
        this.cameraDistance = 10;
        this.cameraHeight = 5;
        this.setupMouseControls();

        // Movement controls
        this.keys = {};
        this.setupControls();

        // Create UI
        this.createUI();

        // Add pause menu state
        this.isPaused = false;
        this.pauseMenu = null;
        this.createPauseMenu();

        // Start game loop
        this.animate();
    }

    createSkybox() {
        const skyboxGeometry = new THREE.BoxGeometry(1000, 1000, 1000);
        const skyboxMaterials = [
            new THREE.MeshBasicMaterial({ color: 0x87CEEB, side: THREE.BackSide }), // right
            new THREE.MeshBasicMaterial({ color: 0x87CEEB, side: THREE.BackSide }), // left
            new THREE.MeshBasicMaterial({ color: 0x87CEEB, side: THREE.BackSide }), // top
            new THREE.MeshBasicMaterial({ color: 0x87CEEB, side: THREE.BackSide }), // bottom
            new THREE.MeshBasicMaterial({ color: 0x87CEEB, side: THREE.BackSide }), // front
            new THREE.MeshBasicMaterial({ color: 0x87CEEB, side: THREE.BackSide })  // back
        ];
        const skybox = new THREE.Mesh(skyboxGeometry, skyboxMaterials);
        this.scene.add(skybox);
    }

    createDecorations() {
        // Add some trees
        const treePositions = [
            { x: 30, z: 30 },
            { x: -30, z: 30 },
            { x: 30, z: -30 },
            { x: -30, z: -30 },
            { x: 50, z: 0 },
            { x: -50, z: 0 }
        ];

        treePositions.forEach(pos => {
            // Tree trunk
            const trunkGeometry = new THREE.CylinderGeometry(0.5, 0.7, 5, 8);
            const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
            const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
            trunk.position.set(pos.x, 2.5, pos.z);
            trunk.castShadow = true;
            trunk.receiveShadow = true;
            this.scene.add(trunk);

            // Tree top
            const topGeometry = new THREE.ConeGeometry(3, 6, 8);
            const topMaterial = new THREE.MeshStandardMaterial({ color: 0x228B22 });
            const top = new THREE.Mesh(topGeometry, topMaterial);
            top.position.set(pos.x, 7, pos.z);
            top.castShadow = true;
            top.receiveShadow = true;
            this.scene.add(top);
        });

        // Add some rocks
        const rockPositions = [
            { x: 20, z: 20 },
            { x: -20, z: 20 },
            { x: 20, z: -20 },
            { x: -20, z: -20 }
        ];

        rockPositions.forEach(pos => {
            const rockGeometry = new THREE.DodecahedronGeometry(2, 0);
            const rockMaterial = new THREE.MeshStandardMaterial({ 
                color: 0x808080,
                roughness: 0.9,
                metalness: 0.1
            });
            const rock = new THREE.Mesh(rockGeometry, rockMaterial);
            rock.position.set(pos.x, 1, pos.z);
            rock.rotation.set(Math.random(), Math.random(), Math.random());
            rock.castShadow = true;
            rock.receiveShadow = true;
            this.scene.add(rock);
        });
    }

    createPlayer(color, playerId = null) {
        // Create a more detailed player model
        const group = new THREE.Group();
        group.userData = { id: playerId || this.socket.id }; // Use provided ID or socket ID

        // Body
        const bodyGeometry = new THREE.BoxGeometry(1, 1.2, 0.6);
        const bodyMaterial = new THREE.MeshStandardMaterial({ 
            color: color,
            roughness: 0.7,
            metalness: 0.2
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.castShadow = true;
        body.receiveShadow = true;
        group.add(body);

        // Head
        const headGeometry = new THREE.SphereGeometry(0.4, 32, 32);
        const headMaterial = new THREE.MeshStandardMaterial({ 
            color: color,
            roughness: 0.7,
            metalness: 0.2
        });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.y = 0.8;
        head.castShadow = true;
        head.receiveShadow = true;
        group.add(head);

        // Eyes
        const eyeGeometry = new THREE.SphereGeometry(0.1, 16, 16);
        const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
        
        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(0.2, 0.9, 0.3);
        group.add(leftEye);
        
        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(-0.2, 0.9, 0.3);
        group.add(rightEye);

        // Pupils
        const pupilGeometry = new THREE.SphereGeometry(0.05, 16, 16);
        const pupilMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });
        
        const leftPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
        leftPupil.position.set(0.2, 0.9, 0.35);
        group.add(leftPupil);
        
        const rightPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
        rightPupil.position.set(-0.2, 0.9, 0.35);
        group.add(rightPupil);

        return group;
    }

    createRope() {
        if (this.rope) {
            this.scene.remove(this.rope);
        }

        const ropeGeometry = new THREE.BufferGeometry();
        const ropeMaterial = new THREE.LineBasicMaterial({ 
            color: 0xffffff,
            linewidth: 2
        });
        
        const points = [];
        for (let i = 0; i <= 10; i++) {
            points.push(new THREE.Vector3(0, 0, 0));
        }
        
        ropeGeometry.setFromPoints(points);
        this.rope = new THREE.Line(ropeGeometry, ropeMaterial);
        this.scene.add(this.rope);
    }

    updateRope() {
        if (this.rope && this.otherPlayer) {
            const points = [];
            const start = this.player.position.clone();
            const end = this.otherPlayer.position.clone();
            
            for (let i = 0; i <= 10; i++) {
                const t = i / 10;
                const point = new THREE.Vector3();
                
                point.x = start.x + (end.x - start.x) * t;
                point.y = start.y + (end.y - start.y) * t + Math.sin(t * Math.PI) * 0.5;
                point.z = start.z + (end.z - start.z) * t;
                
                points.push(point);
            }
            
            this.rope.geometry.setFromPoints(points);
            this.rope.geometry.attributes.position.needsUpdate = true;
        }
    }

    setupControls() {
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.togglePause();
                return;
            }
            
            if (!this.isPaused) {
                this.keys[e.key] = true;
                if (e.key === ' ' && !this.isJumping) {
                    this.jump();
                }
            }
        });
        window.addEventListener('keyup', (e) => {
            if (e.key !== 'Escape') {
                this.keys[e.key] = false;
            }
        });
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    jump() {
        if (!this.isJumping) {
            this.velocity.y = this.jumpForce;
            this.isJumping = true;
        }
    }

    setupMultiplayer() {
        // Use the current window location for the server
        const serverUrl = window.location.origin;
        
        // Connect to server
        this.socket = io(serverUrl, {
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            transports: ['websocket', 'polling']
        });
        this.roomCode = null;

        this.socket.on('connect', () => {
            console.log('Connected to server with ID:', this.socket.id);
            this.statusMessage.textContent = 'Connected to server';
            // Create local player after connection
            this.player = this.createPlayer(0x00ff00);
            this.scene.add(this.player);
            // Enable room creation once connected
            this.createRoomBtn.disabled = false;
        });

        this.socket.on('connect_error', (error) => {
            console.error('Connection error:', error);
            this.statusMessage.textContent = 'Connection error. Please make sure the server is running on localhost:3000';
            this.createRoomBtn.disabled = true;
            this.joinRoomInput.disabled = true;
            this.joinRoomBtn.disabled = true;
        });

        this.socket.on('disconnect', (reason) => {
            console.log('Disconnected from server:', reason);
            this.statusMessage.textContent = 'Disconnected from server';
            this.roomCode = null;
            this.roomCodeDisplay.textContent = '';
            this.createRoomBtn.disabled = false;
            this.joinRoomInput.disabled = false;
            this.joinRoomBtn.disabled = false;
        });

        this.socket.on('roomCreated', (data) => {
            console.log('Room created event received:', data);
            if (!data || !data.roomCode) {
                console.error('Invalid room data received:', data);
                this.statusMessage.textContent = 'Error: Invalid room data received';
                this.createRoomBtn.disabled = false;
                return;
            }
            this.roomCode = data.roomCode;
            this.roomCodeDisplay.textContent = `Room Code: ${this.roomCode}`;
            this.copyRoomCodeBtn.style.display = 'inline-block';
            this.statusMessage.textContent = 'Room created! Share this code with others';
            console.log('Room created successfully with code:', this.roomCode);
        });

        this.socket.on('roomJoined', (data) => {
            console.log('Joined room:', data.roomCode);
            this.roomCode = data.roomCode;
            this.roomCodeDisplay.textContent = `Room Code: ${this.roomCode}`;
            this.copyRoomCodeBtn.style.display = 'inline-block';
            this.statusMessage.textContent = 'Successfully joined room!';
            
            // Create other players if they exist
            data.players.forEach(playerData => {
                if (playerData.id !== this.socket.id) {
                    this.otherPlayer = this.createPlayer(0xff0000, playerData.id);
                    this.otherPlayer.position.copy(playerData.position);
                    this.scene.add(this.otherPlayer);
                    this.createRope();
                }
            });
        });

        this.socket.on('playerJoined', (playerData) => {
            console.log('Player joined:', playerData.id);
            this.statusMessage.textContent = 'Another player joined!';
            this.otherPlayer = this.createPlayer(0xff0000, playerData.id);
            this.otherPlayer.position.copy(playerData.position);
            this.scene.add(this.otherPlayer);
            this.createRope();
        });

        this.socket.on('playerMoved', (playerData) => {
            console.log('Player moved:', playerData.id, playerData.position);
            if (this.otherPlayer && this.otherPlayer.userData.id === playerData.id) {
                this.otherPlayer.position.copy(playerData.position);
                this.otherPlayer.rotation.copy(playerData.rotation);
            }
        });

        this.socket.on('playerDisconnected', (playerId) => {
            console.log('Player disconnected:', playerId);
            this.statusMessage.textContent = 'A player has left the room';
            if (this.otherPlayer && this.otherPlayer.userData.id === playerId) {
                this.scene.remove(this.otherPlayer);
                this.scene.remove(this.rope);
                this.otherPlayer = null;
                this.rope = null;
            }
        });

        this.socket.on('roomError', (message) => {
            console.error('Room error:', message);
            this.statusMessage.textContent = `Error: ${message}`;
            this.createRoomBtn.disabled = false;
            this.joinRoomInput.disabled = false;
            this.joinRoomBtn.disabled = false;
        });

        this.socket.on('roomClosed', () => {
            console.log('Room closed');
            this.statusMessage.textContent = 'Room has been closed by the host';
            this.roomCode = null;
            this.roomCodeDisplay.textContent = '';
            this.createRoomBtn.disabled = false;
            this.joinRoomInput.disabled = false;
            this.joinRoomBtn.disabled = false;
        });
    }

    createPlatforms() {
        // Platform material
        const platformMaterial = new THREE.MeshStandardMaterial({
            color: 0x4444ff,
            roughness: 0.7,
            metalness: 0.2
        });

        // Create platforms at different heights and positions
        const platformPositions = [
            { x: 5, y: 2, z: -5, width: 3, height: 0.5, depth: 3 },
            { x: 10, y: 4, z: -8, width: 3, height: 0.5, depth: 3 },
            { x: 15, y: 6, z: -5, width: 3, height: 0.5, depth: 3 },
            { x: 20, y: 8, z: -8, width: 3, height: 0.5, depth: 3 },
            { x: 25, y: 10, z: -5, width: 3, height: 0.5, depth: 3 },
            // Moving platform
            { x: 30, y: 12, z: -8, width: 3, height: 0.5, depth: 3, isMoving: true }
        ];

        platformPositions.forEach(pos => {
            const geometry = new THREE.BoxGeometry(pos.width, pos.height, pos.depth);
            const platform = new THREE.Mesh(geometry, platformMaterial);
            platform.position.set(pos.x, pos.y, pos.z);
            platform.castShadow = true;
            platform.receiveShadow = true;
            platform.userData = {
                isMoving: pos.isMoving || false,
                originalY: pos.y,
                moveRange: 2,
                moveSpeed: 0.02
            };
            this.scene.add(platform);
            this.platforms.push(platform);
        });
    }

    updatePlatforms() {
        this.platforms.forEach(platform => {
            if (platform.userData.isMoving) {
                // Move platform up and down
                platform.position.y = platform.userData.originalY + 
                    Math.sin(Date.now() * platform.userData.moveSpeed) * platform.userData.moveRange;
            }
        });
    }

    checkPlatformCollisions(player) {
        const playerBox = new THREE.Box3().setFromObject(player);
        
        for (const platform of this.platforms) {
            const platformBox = new THREE.Box3().setFromObject(platform);
            
            if (playerBox.intersectsBox(platformBox)) {
                if (player.position.y > platform.position.y + platform.geometry.parameters.height / 2) {
                    player.position.y = platform.position.y + platform.geometry.parameters.height / 2 + this.playerHeight / 2;
                    this.velocity.y = 0;
                    this.isJumping = false;
                    return true;
                }
            }
        }
        return false;
    }

    setupMouseControls() {
        // Lock pointer on click
        this.renderer.domElement.addEventListener('click', () => {
            this.renderer.domElement.requestPointerLock();
        });

        // Handle pointer lock change
        document.addEventListener('pointerlockchange', () => {
            if (document.pointerLockElement === this.renderer.domElement) {
                document.addEventListener('mousemove', this.onMouseMove.bind(this));
            } else {
                document.removeEventListener('mousemove', this.onMouseMove.bind(this));
            }
        });

        // Add instructions to UI
        const instructions = document.createElement('div');
        instructions.style.position = 'absolute';
        instructions.style.top = '50%';
        instructions.style.left = '50%';
        instructions.style.transform = 'translate(-50%, -50%)';
        instructions.style.color = 'white';
        instructions.style.fontFamily = 'Arial';
        instructions.style.fontSize = '24px';
        instructions.style.textAlign = 'center';
        instructions.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        instructions.style.padding = '20px';
        instructions.style.borderRadius = '10px';
        instructions.innerHTML = 'Click to play<br>WASD to move<br>SPACE to jump<br>Mouse to look around';
        document.body.appendChild(instructions);

        // Hide instructions when game starts
        document.addEventListener('pointerlockchange', () => {
            instructions.style.display = document.pointerLockElement === this.renderer.domElement ? 'none' : 'block';
        });
    }

    onMouseMove(event) {
        if (document.pointerLockElement === this.renderer.domElement) {
            this.cameraRotation.y -= event.movementX * this.mouseSensitivity;
            this.cameraRotation.x -= event.movementY * this.mouseSensitivity;
            
            // Limit vertical rotation to prevent flipping
            this.cameraRotation.x = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, this.cameraRotation.x));
            
            this.camera.quaternion.setFromEuler(this.cameraRotation);
        }
    }

    updatePlayer() {
        if (this.isPaused) return;

        const speed = 0.15;
        
        // Reset velocity
        this.velocity.x = 0;
        this.velocity.z = 0;

        // Get camera direction
        const cameraDirection = new THREE.Vector3();
        this.camera.getWorldDirection(cameraDirection);
        cameraDirection.y = 0;
        cameraDirection.normalize();

        // Get camera right vector
        const cameraRight = new THREE.Vector3();
        cameraRight.crossVectors(new THREE.Vector3(0, 1, 0), cameraDirection);

        // Handle movement
        if (this.keys['w']) {
            this.velocity.add(cameraDirection.clone().multiplyScalar(speed));
        }
        if (this.keys['s']) {
            this.velocity.add(cameraDirection.clone().multiplyScalar(-speed));
        }
        if (this.keys['a']) {
            this.velocity.add(cameraRight.clone().multiplyScalar(speed));
        }
        if (this.keys['d']) {
            this.velocity.add(cameraRight.clone().multiplyScalar(-speed));
        }

        // Apply gravity
        this.velocity.y -= this.gravity;

        // Update position
        this.player.position.x += this.velocity.x;
        this.player.position.y += this.velocity.y;
        this.player.position.z += this.velocity.z;

        // Check platform collisions
        const onPlatform = this.checkPlatformCollisions(this.player);

        // Ground collision
        if (!onPlatform && this.player.position.y <= this.playerHeight / 2) {
            this.player.position.y = this.playerHeight / 2;
            this.velocity.y = 0;
            this.isJumping = false;
        }

        // Apply rope constraint
        this.applyRopeConstraint();

        // Update camera position
        const targetPosition = this.otherPlayer ? 
            new THREE.Vector3().addVectors(this.player.position, this.otherPlayer.position).multiplyScalar(0.5) :
            this.player.position;

        const cameraOffset = new THREE.Vector3(0, this.cameraHeight, this.cameraDistance);
        cameraOffset.applyQuaternion(this.camera.quaternion);
        this.camera.position.copy(targetPosition).add(cameraOffset);

        // Send position update to server
        if (this.roomCode) {
            const position = {
                x: this.player.position.x,
                y: this.player.position.y,
                z: this.player.position.z
            };
            const rotation = {
                x: this.player.rotation.x,
                y: this.player.rotation.y,
                z: this.player.rotation.z
            };
            console.log('Sending position update:', position);
            this.socket.emit('playerMove', {
                roomCode: this.roomCode,
                position: position,
                rotation: rotation
            });
        }
    }

    applyRopeConstraint() {
        if (this.otherPlayer) {
            const distance = this.player.position.distanceTo(this.otherPlayer.position);
            
            if (distance > this.maxRopeLength) {
                const direction = new THREE.Vector3()
                    .subVectors(this.otherPlayer.position, this.player.position)
                    .normalize();
                
                const correction = (distance - this.maxRopeLength) * 0.5;
                
                this.player.position.add(direction.clone().multiplyScalar(correction));
                this.otherPlayer.position.sub(direction.clone().multiplyScalar(correction));
            }
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        if (!this.isPaused) {
            this.updatePlatforms();
            this.updatePlayer();
            this.updateRope();
        }
        this.renderer.render(this.scene, this.camera);
    }

    createUI() {
        // Create room UI container
        this.uiContainer = document.createElement('div');
        this.uiContainer.style.position = 'absolute';
        this.uiContainer.style.top = '10px';
        this.uiContainer.style.left = '10px';
        this.uiContainer.style.color = 'white';
        this.uiContainer.style.fontFamily = 'Arial';
        this.uiContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        this.uiContainer.style.padding = '10px';
        this.uiContainer.style.borderRadius = '5px';
        document.body.appendChild(this.uiContainer);

        // Create room button
        this.createRoomBtn = document.createElement('button');
        this.createRoomBtn.textContent = 'Create Room';
        this.createRoomBtn.style.padding = '10px';
        this.createRoomBtn.style.margin = '5px';
        this.createRoomBtn.style.cursor = 'pointer';
        this.createRoomBtn.onclick = () => this.createRoom();
        this.uiContainer.appendChild(this.createRoomBtn);

        // Room code container
        const roomCodeContainer = document.createElement('div');
        roomCodeContainer.style.margin = '5px';
        roomCodeContainer.style.display = 'flex';
        roomCodeContainer.style.alignItems = 'center';
        roomCodeContainer.style.gap = '5px';
        this.uiContainer.appendChild(roomCodeContainer);

        // Room code display
        this.roomCodeDisplay = document.createElement('div');
        this.roomCodeDisplay.style.fontSize = '16px';
        this.roomCodeDisplay.style.fontWeight = 'bold';
        roomCodeContainer.appendChild(this.roomCodeDisplay);

        // Copy room code button
        this.copyRoomCodeBtn = document.createElement('button');
        this.copyRoomCodeBtn.textContent = '📋';
        this.copyRoomCodeBtn.style.padding = '5px 10px';
        this.copyRoomCodeBtn.style.cursor = 'pointer';
        this.copyRoomCodeBtn.style.display = 'none';
        this.copyRoomCodeBtn.onclick = () => this.copyRoomCode();
        roomCodeContainer.appendChild(this.copyRoomCodeBtn);

        // Join room input
        this.joinRoomInput = document.createElement('input');
        this.joinRoomInput.placeholder = 'Enter Room Code';
        this.joinRoomInput.style.padding = '10px';
        this.joinRoomInput.style.margin = '5px';
        this.joinRoomInput.style.width = '150px';
        this.uiContainer.appendChild(this.joinRoomInput);

        // Join room button
        this.joinRoomBtn = document.createElement('button');
        this.joinRoomBtn.textContent = 'Join Room';
        this.joinRoomBtn.style.padding = '10px';
        this.joinRoomBtn.style.margin = '5px';
        this.joinRoomBtn.style.cursor = 'pointer';
        this.joinRoomBtn.onclick = () => this.joinRoom();
        this.uiContainer.appendChild(this.joinRoomBtn);

        // Status message
        this.statusMessage = document.createElement('div');
        this.statusMessage.style.margin = '5px';
        this.statusMessage.style.color = '#ffeb3b';
        this.uiContainer.appendChild(this.statusMessage);
    }

    copyRoomCode() {
        if (this.roomCode) {
            navigator.clipboard.writeText(this.roomCode).then(() => {
                this.statusMessage.textContent = 'Room code copied to clipboard!';
                setTimeout(() => {
                    this.statusMessage.textContent = '';
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy room code:', err);
                this.statusMessage.textContent = 'Failed to copy room code';
            });
        }
    }

    createRoom() {
        if (!this.socket.connected) {
            this.statusMessage.textContent = 'Not connected to server. Please make sure the server is running on localhost:3000';
            return;
        }

        this.statusMessage.textContent = 'Creating room...';
        console.log('Emitting createRoom event');
        
        // Add a timeout to detect if the server doesn't respond
        const timeout = setTimeout(() => {
            console.error('Room creation timed out');
            this.statusMessage.textContent = 'Room creation timed out. Please try again.';
            this.createRoomBtn.disabled = false;
        }, 5000);

        this.socket.emit('createRoom', (error) => {
            clearTimeout(timeout);
            if (error) {
                console.error('Error creating room:', error);
                this.statusMessage.textContent = 'Error creating room. Please try again.';
                this.createRoomBtn.disabled = false;
            }
        });
        
        this.createRoomBtn.disabled = true;
        this.joinRoomInput.disabled = true;
        this.joinRoomBtn.disabled = true;
    }

    joinRoom() {
        if (!this.socket.connected) {
            this.statusMessage.textContent = 'Not connected to server. Please refresh the page.';
            return;
        }

        const roomCode = this.joinRoomInput.value.toUpperCase();
        if (roomCode) {
            this.statusMessage.textContent = 'Joining room...';
            console.log('Emitting joinRoom event with code:', roomCode);
            this.socket.emit('joinRoom', roomCode, (error) => {
                if (error) {
                    console.error('Error joining room:', error);
                    this.statusMessage.textContent = 'Error joining room. Please try again.';
                    this.createRoomBtn.disabled = false;
                    this.joinRoomInput.disabled = false;
                    this.joinRoomBtn.disabled = false;
                }
            });
            this.createRoomBtn.disabled = true;
            this.joinRoomInput.disabled = true;
            this.joinRoomBtn.disabled = true;
        } else {
            this.statusMessage.textContent = 'Please enter a room code';
        }
    }

    createPauseMenu() {
        this.pauseMenu = document.createElement('div');
        this.pauseMenu.style.position = 'absolute';
        this.pauseMenu.style.top = '50%';
        this.pauseMenu.style.left = '50%';
        this.pauseMenu.style.transform = 'translate(-50%, -50%)';
        this.pauseMenu.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        this.pauseMenu.style.padding = '20px';
        this.pauseMenu.style.borderRadius = '10px';
        this.pauseMenu.style.color = 'white';
        this.pauseMenu.style.fontFamily = 'Arial';
        this.pauseMenu.style.textAlign = 'center';
        this.pauseMenu.style.display = 'none';
        this.pauseMenu.style.zIndex = '1000';

        const title = document.createElement('h2');
        title.textContent = 'Game Paused';
        title.style.marginBottom = '20px';
        this.pauseMenu.appendChild(title);

        const resumeButton = document.createElement('button');
        resumeButton.textContent = 'Resume Game';
        resumeButton.style.padding = '10px 20px';
        resumeButton.style.margin = '5px';
        resumeButton.style.cursor = 'pointer';
        resumeButton.onclick = () => this.resumeGame();
        this.pauseMenu.appendChild(resumeButton);

        const menuButton = document.createElement('button');
        menuButton.textContent = 'Return to Menu';
        menuButton.style.padding = '10px 20px';
        menuButton.style.margin = '5px';
        menuButton.style.cursor = 'pointer';
        menuButton.onclick = () => this.returnToMenu();
        this.pauseMenu.appendChild(menuButton);

        document.body.appendChild(this.pauseMenu);
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        if (this.isPaused) {
            this.pauseMenu.style.display = 'block';
            document.exitPointerLock();
        } else {
            this.pauseMenu.style.display = 'none';
            this.renderer.domElement.requestPointerLock();
        }
    }

    resumeGame() {
        this.isPaused = false;
        this.pauseMenu.style.display = 'none';
        this.renderer.domElement.requestPointerLock();
    }

    returnToMenu() {
        this.isPaused = false;
        this.pauseMenu.style.display = 'none';
        
        // Reset game state
        this.player.position.set(0, 1, 0);
        this.velocity.set(0, 0, 0);
        this.isJumping = false;
        
        // Reset room state
        if (this.roomCode) {
            this.socket.emit('leaveRoom', this.roomCode);
            this.roomCode = null;
            this.roomCodeDisplay.textContent = '';
        }
        
        // Remove other player and rope if they exist
        if (this.otherPlayer) {
            this.scene.remove(this.otherPlayer);
            this.otherPlayer = null;
        }
        if (this.rope) {
            this.scene.remove(this.rope);
            this.rope = null;
        }
        
        // Re-enable room controls
        this.createRoomBtn.disabled = false;
        this.joinRoomInput.disabled = false;
        this.joinRoomBtn.disabled = false;
    }
}

// Start the game when the page loads
window.addEventListener('load', () => {
    new Game();
}); 