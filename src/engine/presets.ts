import { MotionPreset, Layer } from '../types';

export const MOTION_PRESETS: MotionPreset[] = [
  {
    id: 'pop-in',
    name: 'Pop In Entrance',
    nameAr: 'انبثاق سريع',
    category: 'entrance',
    description: 'Scales up smoothly with elastic bounce easing',
    apply: (layer: Layer): Layer => {
      const copy: Layer = JSON.parse(JSON.stringify(layer));
      copy.transform.scale.keyframes = [
        { id: 'k1', frame: 0, value: { x: 0, y: 0, z: 100 }, easing: 'elastic' },
        { id: 'k2', frame: 15, value: { x: 100, y: 100, z: 100 }, easing: 'ease-out' }
      ];
      copy.transform.opacity.keyframes = [
        { id: 'k1', frame: 0, value: 0, easing: 'ease-out' },
        { id: 'k2', frame: 10, value: 100, easing: 'ease-out' }
      ];
      return copy;
    }
  },
  {
    id: 'slide-up-bounce',
    name: 'Slide Up Bounce',
    nameAr: 'انزلاق للأعلى مع ارتداد',
    category: 'entrance',
    description: 'Slides up from bottom with spring bounce',
    apply: (layer: Layer): Layer => {
      const copy: Layer = JSON.parse(JSON.stringify(layer));
      const currentPos = copy.transform.position.value;
      copy.transform.position.keyframes = [
        { id: 'k1', frame: 0, value: { ...currentPos, y: currentPos.y + 150 }, easing: 'bounce' },
        { id: 'k2', frame: 20, value: currentPos, easing: 'ease-out' }
      ];
      copy.transform.opacity.keyframes = [
        { id: 'k1', frame: 0, value: 0, easing: 'linear' },
        { id: 'k2', frame: 12, value: 100, easing: 'linear' }
      ];
      return copy;
    }
  },
  {
    id: 'spin-reveal',
    name: '3D Spin Reveal',
    nameAr: 'دوران ثلاثي الأبعاد',
    category: 'entrance',
    description: 'Rotates 360 degrees on Y axis while fading in',
    apply: (layer: Layer): Layer => {
      const copy: Layer = JSON.parse(JSON.stringify(layer));
      copy.transform.rotation.keyframes = [
        { id: 'k1', frame: 0, value: { x: 0, y: 0, z: -180 }, easing: 'ease-out' },
        { id: 'k2', frame: 25, value: { x: 0, y: 0, z: 0 }, easing: 'ease-out' }
      ];
      copy.transform.scale.keyframes = [
        { id: 'k1', frame: 0, value: { x: 20, y: 20, z: 100 }, easing: 'ease-out' },
        { id: 'k2', frame: 25, value: { x: 100, y: 100, z: 100 }, easing: 'ease-out' }
      ];
      return copy;
    }
  },
  {
    id: 'wiggle-loop',
    name: 'Wiggle Vibration',
    nameAr: 'اهتزاز مستمر',
    category: 'loop',
    description: 'Adds continuous organic wiggle expression to position',
    apply: (layer: Layer): Layer => {
      const copy: Layer = JSON.parse(JSON.stringify(layer));
      copy.transform.position.expression = 'wiggle(4, 15)';
      return copy;
    }
  },
  {
    id: 'floating-pulse',
    name: 'Floating Pulse',
    nameAr: 'نبض طافٍ',
    category: 'loop',
    description: 'Looping breathing scale animation',
    apply: (layer: Layer): Layer => {
      const copy: Layer = JSON.parse(JSON.stringify(layer));
      copy.transform.scale.keyframes = [
        { id: 'k1', frame: 0, value: { x: 100, y: 100, z: 100 }, easing: 'ease-in-out' },
        { id: 'k2', frame: 15, value: { x: 110, y: 110, z: 100 }, easing: 'ease-in-out' },
        { id: 'k3', frame: 30, value: { x: 100, y: 100, z: 100 }, easing: 'ease-in-out' }
      ];
      copy.transform.scale.expression = 'loop()';
      return copy;
    }
  },
  {
    id: 'glitch-burst',
    name: 'Glitch Burst Effect',
    nameAr: 'تأثير تشويش جليتش',
    category: 'transition',
    description: 'Applies GLSL glitch shader and chromatic aberration',
    apply: (layer: Layer): Layer => {
      const copy: Layer = JSON.parse(JSON.stringify(layer));
      copy.effects = [
        {
          id: 'eff-glitch',
          type: 'glitch',
          name: 'Glitch Shifter',
          enabled: true,
          params: { intensity: 0.8 }
        },
        {
          id: 'eff-chroma',
          type: 'chromatic',
          name: 'RGB Split',
          enabled: true,
          params: { amount: 8 }
        }
      ];
      return copy;
    }
  },
  {
    id: 'neon-glow',
    name: 'Neon Cyber Glow',
    nameAr: 'توهج نيون سايبر',
    category: 'transition',
    description: 'Adds vibrant neon outer glow shader effect',
    apply: (layer: Layer): Layer => {
      const copy: Layer = JSON.parse(JSON.stringify(layer));
      copy.effects.push({
        id: 'eff-glow',
        type: 'glow',
        name: 'Neon Glow',
        enabled: true,
        params: { color: '#3b82f6', blur: 30 }
      });
      return copy;
    }
  },
  {
    id: 'zoom-in-smooth',
    name: 'Smooth Zoom In',
    nameAr: 'تقريب ناعم (Smooth Zoom In)',
    category: 'entrance',
    description: 'Smoothly zooms in scale from 100% to 180%',
    apply: (layer: Layer): Layer => {
      const copy: Layer = JSON.parse(JSON.stringify(layer));
      copy.transform.scale.keyframes = [
        { id: 'k1', frame: 0, value: { x: 100, y: 100, z: 100 }, easing: 'ease-out' },
        { id: 'k2', frame: 25, value: { x: 180, y: 180, z: 100 }, easing: 'ease-out' }
      ];
      return copy;
    }
  },
  {
    id: 'zoom-out-punch',
    name: 'Zoom Out Punch',
    nameAr: 'زوم خروج سريع (Zoom Out Punch)',
    category: 'entrance',
    description: 'Punches out from 220% down to 100% scale',
    apply: (layer: Layer): Layer => {
      const copy: Layer = JSON.parse(JSON.stringify(layer));
      copy.transform.scale.keyframes = [
        { id: 'k1', frame: 0, value: { x: 220, y: 220, z: 100 }, easing: 'bounce' },
        { id: 'k2', frame: 25, value: { x: 100, y: 100, z: 100 }, easing: 'ease-out' }
      ];
      return copy;
    }
  },
  {
    id: 'ken-burns-zoom',
    name: 'Ken Burns Camera Zoom',
    nameAr: 'زوم كاميرا سينمائي (Ken Burns)',
    category: 'loop',
    description: 'Continuous slow pan/zoom effect over full duration',
    apply: (layer: Layer): Layer => {
      const copy: Layer = JSON.parse(JSON.stringify(layer));
      copy.transform.scale.keyframes = [
        { id: 'k1', frame: 0, value: { x: 100, y: 100, z: 100 }, easing: 'ease-in-out' },
        { id: 'k2', frame: 60, value: { x: 145, y: 145, z: 100 }, easing: 'ease-in-out' }
      ];
      return copy;
    }
  },
  {
    id: 'pulse-zoom-impact',
    name: 'Zoom Beat Impact',
    nameAr: 'نبض الزوم المعزز (Beat Impact Zoom)',
    category: 'loop',
    description: 'Elastic zoom pop on musical beat',
    apply: (layer: Layer): Layer => {
      const copy: Layer = JSON.parse(JSON.stringify(layer));
      copy.transform.scale.keyframes = [
        { id: 'k1', frame: 0, value: { x: 100, y: 100, z: 100 }, easing: 'elastic' },
        { id: 'k2', frame: 12, value: { x: 140, y: 140, z: 100 }, easing: 'elastic' },
        { id: 'k3', frame: 25, value: { x: 100, y: 100, z: 100 }, easing: 'ease-out' }
      ];
      return copy;
    }
  },
  // =================== NODE VIDEO 3D MOTION PRESETS ===================
  {
    id: 'nv-3d-cube-spin',
    name: 'Node Video 3D Cube Spin',
    nameAr: 'مكعب 3D - دوران كامل 360° (Node Video)',
    category: 'loop',
    description: 'Enables 3D Cube mesh with smooth 360° continuous Y-axis rotation and dynamic lighting',
    apply: (layer: Layer): Layer => {
      const copy: Layer = JSON.parse(JSON.stringify(layer));
      copy.mesh3dConfig = {
        enabled: true,
        type: 'cube',
        depth: 140,
        bevel: 4,
        roughness: 0.25,
        specular: 0.8,
        lightAngle: 45,
        lightElevation: 30,
        castFloorShadow: true,
        castFloorReflection: true,
      };
      copy.transform.rotation.keyframes = [
        { id: 'k1', frame: 0, value: { x: -15, y: 0, z: 0 }, easing: 'linear' },
        { id: 'k2', frame: 60, value: { x: -15, y: 360, z: 0 }, easing: 'linear' }
      ];
      copy.transform.rotation.expression = 'loop()';
      return copy;
    }
  },
  {
    id: 'nv-3d-cube-flip-transition',
    name: 'Node Video 3D Cube Flip',
    nameAr: 'انتقال مكعب ثلاثي الأبعاد (Cube Flip Transition)',
    category: 'transition',
    description: 'Dynamic 90-degree 3D Cube flip with depth push and elastic settling',
    apply: (layer: Layer): Layer => {
      const copy: Layer = JSON.parse(JSON.stringify(layer));
      copy.mesh3dConfig = {
        enabled: true,
        type: 'cube',
        depth: 120,
        specular: 0.9,
        castFloorShadow: true,
      };
      const curPos = copy.transform.position.value;
      copy.transform.position.keyframes = [
        { id: 'k1', frame: 0, value: { ...curPos, z: -250 }, easing: 'ease-out' },
        { id: 'k2', frame: 15, value: { ...curPos, z: -100 }, easing: 'ease-in-out' },
        { id: 'k3', frame: 30, value: { ...curPos, z: 0 }, easing: 'ease-out' }
      ];
      copy.transform.rotation.keyframes = [
        { id: 'k1', frame: 0, value: { x: 0, y: -90, z: 0 }, easing: 'ease-in-out' },
        { id: 'k2', frame: 30, value: { x: 0, y: 0, z: 0 }, easing: 'ease-out' }
      ];
      copy.transform.scale.keyframes = [
        { id: 'k1', frame: 0, value: { x: 70, y: 70, z: 100 }, easing: 'ease-out' },
        { id: 'k2', frame: 30, value: { x: 100, y: 100, z: 100 }, easing: 'ease-out' }
      ];
      return copy;
    }
  },
  {
    id: 'nv-3d-extrusion-pop',
    name: 'Node Video 3D Extrusion Pop',
    nameAr: 'بروز ثلاثي الأبعاد فاخر (3D Extrusion Pop)',
    category: 'entrance',
    description: 'Gives the layer realistic 3D side-wall thickness, bevel, metallic lighting and pop-in entrance',
    apply: (layer: Layer): Layer => {
      const copy: Layer = JSON.parse(JSON.stringify(layer));
      copy.mesh3dConfig = {
        enabled: true,
        type: 'extrusion',
        depth: 80,
        bevel: 6,
        roughness: 0.15,
        metalness: 0.7,
        specular: 1.0,
        lightAngle: 120,
        lightElevation: 45,
        castFloorShadow: true,
      };
      copy.transform.rotation.keyframes = [
        { id: 'k1', frame: 0, value: { x: 25, y: -45, z: -15 }, easing: 'ease-out' },
        { id: 'k2', frame: 25, value: { x: 0, y: 0, z: 0 }, easing: 'ease-out' }
      ];
      copy.transform.scale.keyframes = [
        { id: 'k1', frame: 0, value: { x: 30, y: 30, z: 30 }, easing: 'elastic' },
        { id: 'k2', frame: 25, value: { x: 100, y: 100, z: 100 }, easing: 'ease-out' }
      ];
      copy.transform.opacity.keyframes = [
        { id: 'k1', frame: 0, value: 0, easing: 'ease-out' },
        { id: 'k2', frame: 10, value: 100, easing: 'ease-out' }
      ];
      return copy;
    }
  },
  {
    id: 'nv-3d-card-flip',
    name: 'Node Video 3D Card / Coin Flip',
    nameAr: 'قلب البطاقة السريع (3D Card Flip)',
    category: 'transition',
    description: 'High-speed 3D Y-axis revolution with 3D Z-depth bounce and floor reflection',
    apply: (layer: Layer): Layer => {
      const copy: Layer = JSON.parse(JSON.stringify(layer));
      copy.mesh3dConfig = {
        enabled: true,
        type: 'plane',
        depth: 20,
        specular: 0.6,
        castFloorReflection: true,
        castFloorShadow: true,
      };
      const curPos = copy.transform.position.value;
      copy.transform.rotation.keyframes = [
        { id: 'k1', frame: 0, value: { x: 0, y: -180, z: 0 }, easing: 'ease-out' },
        { id: 'k2', frame: 24, value: { x: 0, y: 0, z: 0 }, easing: 'ease-out' }
      ];
      copy.transform.position.keyframes = [
        { id: 'k1', frame: 0, value: { ...curPos, z: -300 }, easing: 'ease-out' },
        { id: 'k2', frame: 12, value: { ...curPos, z: 120 }, easing: 'ease-in-out' },
        { id: 'k3', frame: 24, value: { ...curPos, z: 0 }, easing: 'ease-out' }
      ];
      return copy;
    }
  },
  {
    id: 'nv-3d-depth-tunnel',
    name: 'Node Video 3D Depth Fly-Through',
    nameAr: 'اختراق العمق والنفق (3D Depth Tunnel)',
    category: 'entrance',
    description: 'Flies from deep in negative Z space past the camera with intense perspective rush',
    apply: (layer: Layer): Layer => {
      const copy: Layer = JSON.parse(JSON.stringify(layer));
      const curPos = copy.transform.position.value;
      copy.transform.position.keyframes = [
        { id: 'k1', frame: 0, value: { ...curPos, z: 1200 }, easing: 'ease-in-out' },
        { id: 'k2', frame: 28, value: { ...curPos, z: 0 }, easing: 'ease-out' }
      ];
      copy.transform.rotation.keyframes = [
        { id: 'k1', frame: 0, value: { x: -30, y: 40, z: 90 }, easing: 'ease-out' },
        { id: 'k2', frame: 28, value: { x: 0, y: 0, z: 0 }, easing: 'ease-out' }
      ];
      copy.transform.opacity.keyframes = [
        { id: 'k1', frame: 0, value: 0, easing: 'ease-in' },
        { id: 'k2', frame: 10, value: 100, easing: 'ease-out' }
      ];
      return copy;
    }
  },
  {
    id: 'nv-3d-bend-unroll',
    name: 'Node Video 3D Curved Screen / Bend',
    nameAr: 'انحناء الشاشة ثلاثي الأبعاد (3D Curved Bend)',
    category: 'loop',
    description: 'Bends layer in 3D cylindrical arc with oscillating wave curvature',
    apply: (layer: Layer): Layer => {
      const copy: Layer = JSON.parse(JSON.stringify(layer));
      copy.mesh3dConfig = {
        enabled: true,
        type: 'bend',
        bendAngle: 60,
        bendAxis: 'y',
        specular: 0.7,
        castFloorShadow: true,
      };
      copy.transform.rotation.keyframes = [
        { id: 'k1', frame: 0, value: { x: 0, y: -25, z: 0 }, easing: 'ease-in-out' },
        { id: 'k2', frame: 30, value: { x: 0, y: 25, z: 0 }, easing: 'ease-in-out' },
        { id: 'k3', frame: 60, value: { x: 0, y: -25, z: 0 }, easing: 'ease-in-out' }
      ];
      copy.transform.rotation.expression = 'loop()';
      return copy;
    }
  },
  {
    id: 'nv-3d-orbit-carousel',
    name: 'Node Video 3D Orbit Carousel',
    nameAr: 'مدار الفضاء الدائري (3D Orbit Carousel)',
    category: 'loop',
    description: 'Orbits around center world space with circular Z and X sinusoidal motion',
    apply: (layer: Layer): Layer => {
      const copy: Layer = JSON.parse(JSON.stringify(layer));
      const curPos = copy.transform.position.value;
      const radius = 280;
      copy.transform.position.keyframes = [
        { id: 'k1', frame: 0, value: { ...curPos, x: curPos.x - radius, z: 0 }, easing: 'linear' },
        { id: 'k2', frame: 15, value: { ...curPos, x: curPos.x, z: radius }, easing: 'linear' },
        { id: 'k3', frame: 30, value: { ...curPos, x: curPos.x + radius, z: 0 }, easing: 'linear' },
        { id: 'k4', frame: 45, value: { ...curPos, x: curPos.x, z: -radius }, easing: 'linear' },
        { id: 'k5', frame: 60, value: { ...curPos, x: curPos.x - radius, z: 0 }, easing: 'linear' }
      ];
      copy.transform.rotation.keyframes = [
        { id: 'k1', frame: 0, value: { x: 0, y: -90, z: 0 }, easing: 'linear' },
        { id: 'k2', frame: 15, value: { x: 0, y: 0, z: 0 }, easing: 'linear' },
        { id: 'k3', frame: 30, value: { x: 0, y: 90, z: 0 }, easing: 'linear' },
        { id: 'k4', frame: 45, value: { x: 0, y: 180, z: 0 }, easing: 'linear' },
        { id: 'k5', frame: 60, value: { x: 0, y: 270, z: 0 }, easing: 'linear' }
      ];
      copy.transform.position.expression = 'loop()';
      copy.transform.rotation.expression = 'loop()';
      return copy;
    }
  },
  {
    id: 'nv-3d-text-flip-video',
    name: '3D Metallic Text Flip (Like Video)',
    nameAr: 'تقليب معدني ثلاثي الأبعاد (مثل الفيديو)',
    category: 'entrance',
    description: 'Realistic metallic 3D text extrusion with smooth cubic-bezier X/Y flip, dynamic specular glint and floor reflection',
    apply: (layer: Layer): Layer => {
      const copy: Layer = JSON.parse(JSON.stringify(layer));
      copy.mesh3dConfig = {
        enabled: true,
        type: 'extrusion',
        material: 'chrome',
        depth: 55,
        bevel: 4,
        roughness: 0.15,
        metalness: 0.85,
        specular: 1.2,
        lightAngle: 60,
        lightElevation: 40,
        castFloorShadow: true,
        castFloorReflection: true,
      };
      copy.transform.rotation.keyframes = [
        {
          id: 'k1',
          frame: 0,
          value: { x: 45, y: -75, z: -10 },
          easing: 'bezier',
          bezierHandle: { x1: 0.4, y1: 0.0, x2: 0.2, y2: 1.0 },
        },
        {
          id: 'k2',
          frame: 24,
          value: { x: -8, y: 15, z: 2 },
          easing: 'bezier',
          bezierHandle: { x1: 0.25, y1: 0.1, x2: 0.25, y2: 1.0 },
        },
        {
          id: 'k3',
          frame: 36,
          value: { x: 0, y: 0, z: 0 },
          easing: 'ease-out',
        },
      ];
      copy.transform.scale.keyframes = [
        {
          id: 'ks1',
          frame: 0,
          value: { x: 40, y: 40, z: 40 },
          easing: 'bezier',
          bezierHandle: { x1: 0.4, y1: 0.0, x2: 0.2, y2: 1.0 },
        },
        {
          id: 'ks2',
          frame: 24,
          value: { x: 105, y: 105, z: 105 },
          easing: 'ease-out',
        },
        {
          id: 'ks3',
          frame: 36,
          value: { x: 100, y: 100, z: 100 },
          easing: 'ease-out',
        },
      ];
      copy.transform.opacity.keyframes = [
        { id: 'ko1', frame: 0, value: 0, easing: 'linear' },
        { id: 'ko2', frame: 8, value: 100, easing: 'ease-out' },
      ];
      return copy;
    },
  },
  {
    id: 'nv-3d-metallic-spin',
    name: '3D Continuous Metallic Spin',
    nameAr: 'دوران معدني مستمر 3D',
    category: 'loop',
    description: 'Smooth 3D continuous loop rotation with chrome side bevel reflections',
    apply: (layer: Layer): Layer => {
      const copy: Layer = JSON.parse(JSON.stringify(layer));
      copy.mesh3dConfig = {
        enabled: true,
        type: 'extrusion',
        material: 'chrome',
        depth: 60,
        bevel: 4,
        specular: 1.25,
        roughness: 0.15,
        castFloorShadow: true,
      };
      copy.transform.rotation.keyframes = [
        { id: 'kr1', frame: 0, value: { x: 15, y: 0, z: 0 }, easing: 'linear' },
        { id: 'kr2', frame: 60, value: { x: 15, y: 360, z: 0 }, easing: 'linear' },
      ];
      copy.transform.rotation.expression = 'loop()';
      return copy;
    },
  },
  {
    id: 'nv-3d-gold-reveal',
    name: '3D Luxury Gold Extrusion',
    nameAr: 'تجسيم ذهبي فاخر 3D',
    category: 'entrance',
    description: '24K Gold extruded 3D geometry with radiant light sweep and elevation',
    apply: (layer: Layer): Layer => {
      const copy: Layer = JSON.parse(JSON.stringify(layer));
      copy.mesh3dConfig = {
        enabled: true,
        type: 'extrusion',
        material: 'gold',
        depth: 70,
        bevel: 5,
        specular: 1.2,
        roughness: 0.2,
        castFloorShadow: true,
        castFloorReflection: true,
      };
      copy.transform.rotation.keyframes = [
        { id: 'kg1', frame: 0, value: { x: -35, y: 55, z: -20 }, easing: 'ease-out' },
        { id: 'kg2', frame: 30, value: { x: 0, y: 0, z: 0 }, easing: 'ease-out' },
      ];
      copy.transform.scale.keyframes = [
        { id: 'kgs1', frame: 0, value: { x: 30, y: 30, z: 30 }, easing: 'elastic' },
        { id: 'kgs2', frame: 30, value: { x: 100, y: 100, z: 100 }, easing: 'ease-out' },
      ];
      return copy;
    },
  },
  {
    id: 'nv-3d-isometric-float',
    name: 'Node Video 3D Isometric Float',
    nameAr: 'الطفو الإيزومتري ثلاثي الأبعاد (Isometric Float)',
    category: 'loop',
    description: 'Locks into 3D isometric perspective angle with gentle floating bob and floor shadow',
    apply: (layer: Layer): Layer => {
      const copy: Layer = JSON.parse(JSON.stringify(layer));
      copy.mesh3dConfig = {
        enabled: true,
        type: 'extrusion',
        material: 'chrome',
        depth: 50,
        bevel: 4,
        specular: 0.85,
        castFloorShadow: true,
        castFloorReflection: true,
      };
      const curPos = copy.transform.position.value;
      copy.transform.rotation.value = { x: 30, y: -40, z: 15 };
      copy.transform.position.keyframes = [
        { id: 'k1', frame: 0, value: { ...curPos, y: curPos.y - 20, z: 0 }, easing: 'ease-in-out' },
        { id: 'k2', frame: 30, value: { ...curPos, y: curPos.y + 20, z: 50 }, easing: 'ease-in-out' },
        { id: 'k3', frame: 60, value: { ...curPos, y: curPos.y - 20, z: 0 }, easing: 'ease-in-out' }
      ];
      copy.transform.position.expression = 'loop()';
      return copy;
    }
  }
];
