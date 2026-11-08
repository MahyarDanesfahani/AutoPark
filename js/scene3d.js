/**
 * scene3d.js — Three.js scene: ground, parking markings, cars, lights,
 * path / footprint / search-node visualization and the parking animation.
 *
 * Coordinate mapping: 2D world (x, y) -> three (x, 0, y); a pose heading
 * theta maps to mesh.rotation.y = -theta. Car meshes are built with the
 * origin at the REAR AXLE (matches the planner pose convention).
 */

import * as THREE from 'three';
import { OrbitControls } from '../lib/OrbitControls.js';
import { VEHICLE } from './vehicle.js';

export const ALGO_COLORS = {
  'hybrid-astar': 0x2ecc71,
  'astar': 0x3498db,
  'rrt': 0xe67e22,
};
const CAR_COLORS = [0xbfc5ca, 0x8f979e, 0x6d7780, 0x4f5a63, 0xa9b2b9];

const WHEEL_R = 0.34;

export class Scene3D {
  constructor(container) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x10141a);
    this.scene.fog = new THREE.Fog(0x10141a, 55, 110);

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 300);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI / 2.02;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 90;

    this._lights();
    this._groups();

    this.anim = { poses: null, t: 0, playing: false, speed: 1.5, roll: 0 };
    this.scenario = null;

    this.clock = new THREE.Clock();
    this.renderer.setAnimationLoop(() => this._tick());

    new ResizeObserver(() => this._resize()).observe(container);
    this._resize();
  }

  _lights() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const hemi = new THREE.HemisphereLight(0xcfd8e3, 0x2a2f36, 0.35);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff2dd, 1.5);
    sun.position.set(14, 26, -10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const c = sun.shadow.camera;
    c.left = -28; c.right = 28; c.top = 28; c.bottom = -28;
    c.near = 2; c.far = 80;
    sun.shadow.bias = -0.0004;
    sun.target.position.set(8, 0, 0);
    this.scene.add(sun, sun.target);
  }

  _groups() {
    this.worldGroup = new THREE.Group();   // rebuilt per scenario
    this.vizGroup = new THREE.Group();     // paths, footprints, search nodes
    this.scene.add(this.worldGroup, this.vizGroup);

    this.ego = this._buildCar(0xd64541, true);
    this.scene.add(this.ego.group);
  }

  // ---------------------------------------------------------------- world

  /** Rebuild the static world for a scenario. */
  buildWorld(sc) {
    this.scenario = sc;
    this.worldGroup.clear();

    const b = sc.bounds;
    const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
    const wx = b.maxX - b.minX + 10, wy = b.maxY - b.minY + 10;

    // grass base + asphalt drivable area
    const grass = new THREE.Mesh(
      new THREE.PlaneGeometry(wx + 26, wy + 26),
      new THREE.MeshStandardMaterial({ color: 0x35502f, roughness: 1 })
    );
    grass.rotation.x = -Math.PI / 2;
    grass.position.set(cx, -0.02, cy);
    grass.receiveShadow = true;
    this.worldGroup.add(grass);

    const asphalt = new THREE.Mesh(
      new THREE.PlaneGeometry(b.maxX - b.minX + 4, b.maxY - b.minY + 4),
      new THREE.MeshStandardMaterial({ color: 0x3d434a, roughness: 0.95 })
    );
    asphalt.rotation.x = -Math.PI / 2;
    asphalt.position.set(cx, 0, cy);
    asphalt.receiveShadow = true;
    this.worldGroup.add(asphalt);

    // obstacles: parked cars vs. thin walls
    let carIdx = 0;
    for (const o of sc.obstacles) {
      if (o.halfW <= 0.25) {
        this.worldGroup.add(this._wall(o));
      } else {
        this.worldGroup.add(this._parkedCar(o, CAR_COLORS[carIdx++ % CAR_COLORS.length]));
      }
    }

    // parking bay outlines around every car-shaped obstacle
    const lineMat = new THREE.LineBasicMaterial({ color: 0xd8dde2, transparent: true, opacity: 0.55 });
    for (const o of sc.obstacles) {
      if (o.halfW <= 0.25) continue;
      const rect = { x: o.x, y: o.y, theta: o.theta, len: o.halfL * 2 + 0.5, wid: o.halfW * 2 + 0.5 };
      this.worldGroup.add(this._groundRect(rect, lineMat));
    }

    // target slot: yellow outline + soft fill
    const slot = sc.slot;
    const outline = this._groundRect(slot, new THREE.LineBasicMaterial({ color: 0xf1c40f }));
    const fill = new THREE.Mesh(
      new THREE.PlaneGeometry(slot.len, slot.wid),
      new THREE.MeshBasicMaterial({ color: 0xf1c40f, transparent: true, opacity: 0.13, depthWrite: false })
    );
    fill.rotation.x = -Math.PI / 2;
    fill.rotation.z = -slot.theta;
    fill.position.set(slot.x, 0.012, slot.y);
    this.worldGroup.add(outline, fill);

    this.resetEgo(sc.start);
    this.setCameraPreset('scene');
    this._clearViz();
  }

  _wall(o) {
    const h = 0.18;
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(o.halfL * 2, h, o.halfW * 2),
      new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.9 })
    );
    m.position.set(o.x, h / 2, o.y);
    m.rotation.y = -o.theta;
    m.castShadow = m.receiveShadow = true;
    return m;
  }

  _parkedCar(o, color) {
    const g = this._buildCar(color, false);
    // Obstacles are defined by their geometric centre, while the car mesh
    // origin is the rear axle. Keep the visual car aligned with collision OBBs.
    g.group.position.set(
      o.x - Math.cos(o.theta) * VEHICLE.bodyCenterOffset,
      0,
      o.y - Math.sin(o.theta) * VEHICLE.bodyCenterOffset,
    );
    g.group.rotation.y = -o.theta;
    return g.group;
  }

  /** Low-poly car, origin at rear axle, forward = +X. */
  _buildCar(color, isEgo) {
    const group = new THREE.Group();
    const L = VEHICLE.length, W = VEHICLE.width;
    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.15 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x18222c, roughness: 0.15, metalness: 0.4 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(L, 0.52, W), bodyMat);
    body.position.set(1.45, 0.55, 0);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.5, W - 0.28), glassMat);
    cabin.position.set(1.15, 1.02, 0);
    body.castShadow = cabin.castShadow = true;
    group.add(body, cabin);

    // wheels: front pair inside steer pivots
    const wheelGeo = new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 0.26, 20);
    wheelGeo.rotateX(Math.PI / 2);
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x14181c, roughness: 0.9 });
    const wheels = { steer: [], all: [] };
    for (const [wx, front] of [[VEHICLE.wheelBase, true], [0, false]]) {
      for (const wz of [W / 2 - 0.1, -(W / 2 - 0.1)]) {
        const pivot = new THREE.Group();
        pivot.position.set(wx, WHEEL_R, wz);
        const wheel = new THREE.Mesh(wheelGeo, tireMat);
        wheel.castShadow = true;
        pivot.add(wheel);
        group.add(pivot);
        wheels.all.push(wheel);
        if (front) wheels.steer.push(pivot);
      }
    }

    if (isEgo) {
      // head/taillights for readability
      const lampGeo = new THREE.BoxGeometry(0.06, 0.12, 0.3);
      const head = new THREE.Mesh(lampGeo, new THREE.MeshBasicMaterial({ color: 0xfff3c4 }));
      head.position.set(3.7, 0.62, 0.55);
      const head2 = head.clone(); head2.position.z = -0.55;
      const tail = new THREE.Mesh(lampGeo, new THREE.MeshBasicMaterial({ color: 0xe74c3c }));
      tail.position.set(-0.78, 0.62, 0.55);
      const tail2 = tail.clone(); tail2.position.z = -0.55;
      group.add(head, head2, tail, tail2);
    }

    return { group, wheels };
  }

  _groundRect(rect, lineMat) {
    const pts = [];
    const c = Math.cos(rect.theta), s = Math.sin(rect.theta);
    for (const [lu, wu] of [[rect.len / 2, rect.wid / 2], [-rect.len / 2, rect.wid / 2],
                            [-rect.len / 2, -rect.wid / 2], [rect.len / 2, -rect.wid / 2]]) {
      pts.push(new THREE.Vector3(rect.x + c * lu - s * wu, 0.015, rect.y + s * lu + c * wu));
    }
    pts.push(pts[0].clone());
    return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat);
  }

  // ------------------------------------------------------------ ego pose

  resetEgo(pose) {
    this.ego.group.position.set(pose.x, 0, pose.y);
    this.ego.group.rotation.y = -pose.theta;
    this._applyWheels(this.ego, 0, 0);
    this.anim.t = 0;
    this.anim.playing = false;
  }

  _applyWheels(car, steer, roll) {
    for (const p of car.wheels.steer) p.rotation.y = -steer;
    for (const w of car.wheels.all) w.rotation.z = roll;
  }

  // -------------------------------------------------------------- results

  _clearViz() {
    this.vizGroup.clear();
    this.anim.poses = null;
    this.anim.playing = false;
    this.anim.t = 0;
  }

  /** Add one algorithm result: path line, swept footprint, search nodes. */
  showResult(res, showSearch) {
    const color = ALGO_COLORS[res.algorithm] ?? 0xffffff;
    if (res.success && res.poses && res.poses.length > 1) {
      const pts = [];
      for (let i = 0; i < res.poses.length; i += 3) {
        pts.push(new THREE.Vector3(res.poses[i].x, 0.07, res.poses[i].y));
      }
      this.vizGroup.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95 })
      ));
      this.vizGroup.add(this._footprint(res.poses, color));
    }
    if (showSearch && res.visited.length >= 3) {
      const pos = new Float32Array((res.visited.length / 3) * 3);
      for (let i = 0, j = 0; i < res.visited.length; i += 3, j += 3) {
        pos[j] = res.visited[i]; pos[j + 1] = 0.05; pos[j + 2] = res.visited[i + 1];
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const pts = new THREE.Points(geo, new THREE.PointsMaterial({
        color, size: 3.5, sizeAttenuation: false, transparent: true, opacity: 0.5, depthWrite: false,
      }));
      this.vizGroup.add(pts);
    }
  }

  /** Semi-transparent ribbon of the car body swept along the path. */
  _footprint(poses, color) {
    const verts = [];
    const c = Math.cos, s = Math.sin;
    const local = [[-0.8, -0.9], [-0.8, 0.9], [3.7, 0.9], [3.7, -0.9]];
    let prev = null;
    for (let i = 0; i < poses.length; i += 4) {
      const p = poses[i];
      const corners = local.map(([lx, ly]) => [
        p.x + c(p.theta) * lx - s(p.theta) * ly,
        p.y + s(p.theta) * lx + c(p.theta) * ly,
      ]);
      if (prev) {
        for (let k = 0; k < 4; k++) {
          const a = prev[k], bq = prev[(k + 1) % 4], cq = corners[k], d = corners[(k + 1) % 4];
          verts.push(a[0], 0.03, a[1], bq[0], 0.03, bq[1], cq[0], 0.03, cq[1]);
          verts.push(a[0], 0.03, a[1], cq[0], 0.03, cq[1], d[0], 0.03, d[1]);
        }
      }
      prev = corners;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
    return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide,
    }));
  }

  // ------------------------------------------------------------ animation

  setAnimation(res, world = null, onCollision = null) {
    this.anim.poses = res && res.success ? res.poses : null;
    this.anim.t = 0;
    this.anim.playing = false;
    this.anim.world = world;
    this.anim.onCollision = onCollision;
    if (this.anim.poses && this.scenario) this.resetEgo(this.scenario.start);
  }

  playPause() {
    if (!this.anim.poses) return false;
    if (!this.anim.playing && this.anim.t >= this.anim.poses.length * 0.1) this.anim.t = 0;
    this.anim.playing = !this.anim.playing;
    return this.anim.playing;
  }

  stop() { this.anim.playing = false; }

  setSpeed(v) { this.anim.speed = v; }

  _tick() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const a = this.anim;
    if (a.playing && a.poses) {
      a.t += dt * a.speed;
      const total = a.poses.length * 0.1;
      if (a.t >= total) { a.t = total; a.playing = false; }
      const ds = 0.1;
      const idxF = a.t / ds;
      const i = Math.min(Math.floor(idxF), a.poses.length - 2);
      const f = Math.min(idxF - i, 1);
      const p0 = a.poses[i], p1 = a.poses[i + 1];
      const x = p0.x + (p1.x - p0.x) * f;
      const y = p0.y + (p1.y - p0.y) * f;
      let dth = p1.theta - p0.theta;
      while (dth > Math.PI) dth -= 2 * Math.PI;
      while (dth < -Math.PI) dth += 2 * Math.PI;
      const theta = p0.theta + dth * f;
      if (a.world && a.world.poseCollides({ x, y, theta }, 0)) {
        a.playing = false;
        if (a.onCollision) a.onCollision();
      }
      this.ego.group.position.set(x, 0, y);
      this.ego.group.rotation.y = -theta;
      a.roll -= (f * ds) / WHEEL_R * (p1.dir || 1);
      this._applyWheels(this.ego, p1.steer || 0, a.roll);
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  // -------------------------------------------------------------- cameras

  setCameraPreset(name) {
    const sc = this.scenario;
    if (!sc) return;
    const sl = sc.slot;
    const cx = sl.x, cy = sl.y;
    let pos, target;
    if (name === 'top') {
      pos = [cx, 36, cy + 0.02]; target = [cx, 0, cy];
    } else if (name === 'side') {
      pos = [cx, 8, cy - 21]; target = [cx, 0.6, cy];
    } else if (name === 'driver') {
      const st = sc.start;
      const bx = st.x - Math.cos(st.theta) * 5.5;
      const by = st.y - Math.sin(st.theta) * 5.5;
      pos = [bx, 2.6, by]; target = [st.x + Math.cos(st.theta) * 6, 0.8, st.y + Math.sin(st.theta) * 6];
    } else {
      pos = [sc.camera.pos[0], sc.camera.pos[2], sc.camera.pos[1]];
      target = [sc.camera.target[0], sc.camera.target[2], sc.camera.target[1]];
    }
    this.camera.position.set(...pos);
    this.controls.target.set(...target);
    this.controls.update();
  }

  _resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
}
