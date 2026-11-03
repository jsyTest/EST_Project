"""OS PTY harness. Never reads credentials or environment configuration."""
import json, os, pty, select, signal, subprocess, sys, termios, time

module, directory, mode, node = sys.argv[1:]
master, slave = pty.openpty()
before = termios.tcgetattr(slave)
code = '''import {main} from %s;
let networkCalls=0;globalThis.fetch=async()=>{networkCalls++;throw Error('network forbidden');};
const exit=await main({args:['--mock'],directory:%s});
console.log(JSON.stringify({networkCalls}));process.exitCode=exit;
''' % (json.dumps(module), json.dumps(directory))
child = subprocess.Popen([node, '--input-type=module', '-e', code], stdin=slave, stdout=slave, stderr=slave, close_fds=True)
transcript = b''
values = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222',
          '33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444',
          'personal-private-test', 'SYNTHETIC_LOCAL_INPUT_NOT_A_REAL_TOKEN']
sent = 0
deadline = time.monotonic()+12
try:
    while time.monotonic()<deadline:
        ready, _, _ = select.select([master], [], [], .05)
        if ready:
            transcript += os.read(master, 65536)
        if mode == 'success':
            if sent < len(values) and transcript.count('입력 숨김'.encode()) > sent:
                os.write(master, (values[sent]+'\r').encode()); sent += 1
        elif sent == 0 and '입력 숨김'.encode() in transcript:
            os.write(master, b'SYNTHETIC_LOCAL_INPUT_NOT_A_REAL_TOKEN')
            if mode == 'ctrl-c': os.write(master, b'\x03')
            else: child.send_signal(signal.SIGTERM)
            sent=1
        if child.poll() is not None:
            while select.select([master], [], [], .02)[0]: transcript+=os.read(master,65536)
            break
    else:
        raise RuntimeError('PTY child timeout')
    after = termios.tcgetattr(slave)
    no_echo = all(v.encode() not in transcript for v in values)
    restored = bool(after[3]&termios.ECHO)==bool(before[3]&termios.ECHO) and bool(after[3]&termios.ICANON)==bool(before[3]&termios.ICANON)
    good_exit = child.returncode == (0 if mode=='success' else 1)
    network_zero = b'"networkCalls":0' in transcript
    assert no_echo and restored and good_exit and network_zero, 'PTY verification failed (transcript withheld)'
    print(json.dumps({'noEcho':no_echo,'restored':restored,'networkCalls':0}))
finally:
    if child.poll() is None: child.kill(); child.wait()
    os.close(master); os.close(slave)
