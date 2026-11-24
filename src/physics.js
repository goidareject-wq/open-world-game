export function createCarState() {
  return { x: 0, z: 0, yaw: 0, speed: 0, steer: 0, damage: 0 };
}

export function stepCar(st, input, type, dt, gripMul = 1, offroad = false) {
  const top = type.topSpeed;
  const disabled = st.damage >= 100;
  const throttle = disabled ? 0 : Math.max(0, Math.min(1, input.throttle));
  const brake = Math.max(0, Math.min(1, input.brake));
  const steerIn = Math.max(-1, Math.min(1, input.steer));

  const offMul = offroad ? type.offroad : 1;
  if (throttle > 0) {
    const power = type.accel * offMul * (1 - Math.max(0, st.speed) / top);
    st.speed += power * throttle * dt;
  }
  if (brake > 0) {
    if (st.speed > 0.5) st.speed -= type.brake * brake * dt;
    else st.speed = Math.max(st.speed - type.accel * 0.6 * offMul * dt, -type.reverseSpeed);
  }
  const drag = 0.6 + st.speed * st.speed * 0.0009;
  st.speed -= Math.sign(st.speed) * Math.min(Math.abs(st.speed), drag * dt * (offroad ? 3.5 : 1));
  if (Math.abs(st.speed) < 0.05 && throttle === 0 && brake === 0) st.speed = 0;
  st.speed = Math.max(-type.reverseSpeed, Math.min(top, st.speed));

  const maxSteer = type.steer * 0.42;
  const target = steerIn * maxSteer * (1 / (1 + Math.abs(st.speed) * 0.045));
  st.steer += (target - st.steer) * Math.min(1, dt * 10);
  const sf = Math.min(1, Math.abs(st.speed) / 7) * (st.speed >= 0 ? 1 : -1);
  st.yaw -= st.steer * sf * gripMul * dt * 1.9;

  const f = { x: Math.sin(st.yaw), z: Math.cos(st.yaw) };
  st.x += f.x * st.speed * dt;
  st.z += f.z * st.speed * dt;
  return f;
}

export function impactDamage(st, prevSpeed, mass = 1) {
  const dv = Math.abs(prevSpeed - st.speed);
  return Math.min(100, st.damage + dv * 2.2 / mass);
}
