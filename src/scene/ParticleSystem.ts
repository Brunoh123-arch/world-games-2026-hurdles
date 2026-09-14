/**
 * World Games 2026 — Hurdles Race
 * Lightweight particle effects using THREE.Points and meshes
 */
import * as THREE from 'three';

export class ParticleSystem {
  private group: THREE.Group = new THREE.Group();

  private windStreaks: THREE.Points;
  private windActive = false;

  private confettiGroup: THREE.Group;
  private confettiActive = false;
  private confettiParticles: { mesh: THREE.Mesh; v: THREE.Vector3 }[] = [];

  private flashbulbs: THREE.Points;
  private flashActive = false;

  private dustGroup: THREE.Group;
  private dustParticles: { mesh: THREE.Mesh; age: number }[] = [];

  private geometries: THREE.BufferGeometry[] = [];
  private materials: THREE.Material[] = [];

  constructor() {
    // ── Wind Streaks ──
    const windGeo = new THREE.BufferGeometry();
    const windPos = new Float32Array(50 * 3);
    for (let i = 0; i < 50; i++) {
      windPos[i * 3] = (Math.random() - 0.5) * 10;
      windPos[i * 3 + 1] = Math.random() * 5 + 0.5;
      windPos[i * 3 + 2] = Math.random() * 20;
    }
    windGeo.setAttribute('position', new THREE.BufferAttribute(windPos, 3));
    const windMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.15,
      transparent: true,
      opacity: 0.6,
    });
    this.windStreaks = new THREE.Points(windGeo, windMat);
    this.windStreaks.visible = false;
    this.group.add(this.windStreaks);
    this.geometries.push(windGeo);
    this.materials.push(windMat);

    // ── Confetti ──
    this.confettiGroup = new THREE.Group();
    this.group.add(this.confettiGroup);
    const confettiGeo = new THREE.PlaneGeometry(0.12, 0.12);
    this.geometries.push(confettiGeo);
    const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff, 0xffd700];
    for (let i = 0; i < 200; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: colors[Math.floor(Math.random() * colors.length)],
        side: THREE.DoubleSide,
      });
      this.materials.push(mat);
      const mesh = new THREE.Mesh(confettiGeo, mat);
      mesh.visible = false;
      this.confettiGroup.add(mesh);
      this.confettiParticles.push({ mesh, v: new THREE.Vector3() });
    }

    // ── Flashbulbs ──
    const flashGeo = new THREE.BufferGeometry();
    const flashPos = new Float32Array(20 * 3);
    for (let i = 0; i < 20; i++) {
      const side = Math.random() > 0.5 ? 1 : -1;
      flashPos[i * 3] = side * (15 + Math.random() * 10);
      flashPos[i * 3 + 1] = 5 + Math.random() * 10;
      flashPos[i * 3 + 2] = (Math.random() - 0.5) * 50;
    }
    flashGeo.setAttribute('position', new THREE.BufferAttribute(flashPos, 3));
    const flashMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.5,
      transparent: true,
      opacity: 0,
    });
    this.flashbulbs = new THREE.Points(flashGeo, flashMat);
    this.group.add(this.flashbulbs);
    this.geometries.push(flashGeo);
    this.materials.push(flashMat);

    // ── Dust ──
    this.dustGroup = new THREE.Group();
    this.group.add(this.dustGroup);
  }

  /** Returns the container group to add to the scene */
  getGroup(): THREE.Group {
    return this.group;
  }

  startWindStreaks(): void {
    this.windActive = true;
    this.windStreaks.visible = true;
  }

  stopWindStreaks(): void {
    this.windActive = false;
    this.windStreaks.visible = false;
  }

  burstConfetti(): void {
    this.confettiActive = true;
    for (const p of this.confettiParticles) {
      p.mesh.position.set(
        (Math.random() - 0.5) * 16,
        14 + Math.random() * 6,
        100 + (Math.random() - 0.5) * 12
      );
      p.v.set(
        (Math.random() - 0.5) * 3,
        -2 - Math.random() * 3.5,
        (Math.random() - 0.5) * 3
      );
      p.mesh.visible = true;
    }
  }

  startFlashbulbs(): void {
    this.flashActive = true;
  }

  stopFlashbulbs(): void {
    this.flashActive = false;
    (this.flashbulbs.material as THREE.PointsMaterial).opacity = 0;
  }

  emitDust(x: number, z: number): void {
    const geo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xcccccc,
      transparent: true,
      opacity: 0.8,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x + (Math.random() - 0.5) * 0.2, 0.1, z + (Math.random() - 0.5) * 0.2);
    this.dustGroup.add(mesh);
    this.dustParticles.push({ mesh, age: 0 });
  }

  update(dt: number, playerPos: THREE.Vector3): void {
    // ── Wind streaks ──
    if (this.windActive) {
      const posAttr = this.windStreaks.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < 50; i++) {
        let z = posAttr.getZ(i);
        z -= 30 * dt;
        if (z < -10) z += 20;
        posAttr.setZ(i, z);
      }
      posAttr.needsUpdate = true;
      this.windStreaks.position.set(playerPos.x, 0, playerPos.z);
    }

    // ── Confetti ──
    if (this.confettiActive) {
      let anyVisible = false;
      for (const p of this.confettiParticles) {
        if (p.mesh.visible) {
          p.mesh.position.addScaledVector(p.v, dt);
          p.mesh.rotation.x += dt * 2;
          p.mesh.rotation.y += dt * 3;
          if (p.mesh.position.y < 0) {
            p.mesh.visible = false;
          } else {
            anyVisible = true;
          }
        }
      }
      if (!anyVisible) this.confettiActive = false;
    }

    // ── Flashbulbs ──
    if (this.flashActive) {
      const mat = this.flashbulbs.material as THREE.PointsMaterial;
      mat.opacity = Math.random() > 0.85 ? 1.0 : 0.0;
      // Move flashbulbs near player
      this.flashbulbs.position.z = playerPos.z;
    }

    // ── Dust ──
    for (let i = this.dustParticles.length - 1; i >= 0; i--) {
      const p = this.dustParticles[i];
      p.age += dt;
      p.mesh.position.y += dt * 0.5;
      p.mesh.scale.setScalar(1 + p.age * 2);
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.8 - p.age * 2);

      if (p.age > 0.4) {
        this.dustGroup.remove(p.mesh);
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
        this.dustParticles.splice(i, 1);
      }
    }
  }

  dispose(): void {
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
    this.geometries = [];
    this.materials = [];
  }
}
