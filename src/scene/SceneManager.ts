import * as THREE from 'three';

export class SceneManager {
    public scene: THREE.Scene;
    public camera: THREE.PerspectiveCamera;
    public renderer: THREE.WebGLRenderer;
    private canvas: HTMLCanvasElement;
    
    public dirLight: THREE.DirectionalLight;

    constructor(container: HTMLElement) {
        this.canvas = document.createElement('canvas');
        container.appendChild(this.canvas);

        this.scene = new THREE.Scene();
        
        // Fog - Sunny Olympic day
        const fogColor = new THREE.Color(0x38bdf8);
        this.scene.fog = new THREE.Fog(fogColor, 100, 350);
        this.scene.background = fogColor;
        
        // Camera
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        
        // Renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: false,
            powerPreference: 'high-performance'
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.1;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        // Lights
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x335533, 1.1);
        this.scene.add(hemiLight);
        
        this.dirLight = new THREE.DirectionalLight(0xfffaed, 2.0);
        this.dirLight.position.set(25, 45, 20);
        this.dirLight.castShadow = true;
        this.dirLight.shadow.mapSize.width = 1024;
        this.dirLight.shadow.mapSize.height = 1024;
        this.dirLight.shadow.camera.near = 1.0;
        this.dirLight.shadow.camera.far = 120;
        this.dirLight.shadow.camera.left = -15;
        this.dirLight.shadow.camera.right = 15;
        this.dirLight.shadow.camera.top = 25;
        this.dirLight.shadow.camera.bottom = -25;
        this.dirLight.shadow.bias = -0.0005;
        this.scene.add(this.dirLight);
        this.scene.add(this.dirLight.target);
        
        // Resize handler
        window.addEventListener('resize', this.onWindowResize);
    }
    
    public updateLight(playerZ: number): void {
        this.dirLight.position.set(20, 35, playerZ + 15);
        this.dirLight.target.position.set(0, 0, playerZ);
        this.dirLight.target.updateMatrixWorld();
    }
    
    private onWindowResize = () => {
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        
        this.renderer.setSize(width, height);
    };
    
    public render(): void {
        this.renderer.render(this.scene, this.camera);
    }
    
    public update(_dt: number): void {
        this.render();
    }
    
    public dispose() {
        window.removeEventListener('resize', this.onWindowResize);
        this.renderer.dispose();
    }
}
