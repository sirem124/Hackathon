# CYBERTRACE Real Kali Linux Deployment

## Development environment assessment

This Windows development host was inspected on November 21, 2026:

- Docker: not detected
- WSL2: not detected
- Hyper-V: not detected
- Virtual Machine Platform: not detected
- QEMU/KVM: not detected
- Logical CPUs: 16
- RAM: approximately 15.77 GB

No real Kali VM, Docker VM, QEMU VM or Apache Guacamole service was created by CYBERTRACE because the required virtualization and desktop gateway infrastructure is absent. The CYBERTRACE UI explicitly reports this instead of fabricating a Linux session.

## Production architecture

```
Browser
  -> CYBERTRACE Express authentication and session
  -> Kali infrastructure control API (private network)
  -> VM orchestrator (QEMU/KVM, Proxmox, or approved hypervisor)
  -> isolated Kali VM pool
  -> Apache Guacamole / guacd
  -> browser VNC/RDP/SSH desktop

VM training network
  -> authorized vulnerable targets only
  -> firewall denies internet/public subnet scanning
```

Never expose Docker sockets, hypervisor APIs, SSH private keys or root credentials to browser users. CYBERTRACE must communicate with one dedicated control API over a private, mTLS-protected network.

## Environment variables

Set these only on the CYBERTRACE server:

- `KALI_CONTROL_API_URL=https://kali-control.internal.example`
- `KALI_CONTROL_API_TOKEN=<short-lived control API credential>`
- `KALI_SESSION_TIMEOUT_MINUTES=120`

The control token must be stored in an OS secret manager or deployment secret store, never in JavaScript or public configuration.

## Control API contract

The private provider implements:

- `POST /v1/environments/start`
- `POST /v1/environments/{environmentId}/stop`
- `POST /v1/environments/{environmentId}/restart`
- `POST /v1/environments/{environmentId}/reset`
- `POST /v1/environments/{environmentId}/reconnect`

Request payload:

```json
{
  "userId": 123,
  "userEmail": "analyst@example.com",
  "sessionMinutes": 120,
  "reset": false
}
```

Authorization header:

```text
Authorization: Bearer <server-only control token>
```

Success response:

```json
{
  "environmentId": "kali-user-123",
  "status": "running",
  "desktopUrl": "https://guacamole.example/session-token",
  "terminalUrl": "wss://terminal.example/session-token",
  "cpuLimit": 2,
  "memoryLimitMb": 4096,
  "diskLimitGb": 25
}
```

## Kali base image

Use an official Kali Linux image with XFCE and the desired Kali metapackages. Recommended minimums: 2 CPU cores, 4 GB RAM and 25 GB dynamic disk. Add dedicated 4-8 GB VM resources for heavier forensic and password-audit tools.

Install tools only in the isolated Kali template:

- nmap, wireshark, tcpdump
- burpsuite, zaproxy, gobuster, nikto
- john, hashcat
- exploitdb, git, python3, gcc
- autopsy, volatility3, binutils, binwalk

`apt update && apt install -y kali-desktop-xfce kali-linux-headless` is suitable for a server foundation; GUI desktop deployments additionally require XFCE and VNC or Guacamole-supported remote desktop components.

## Apache Guacamole

Guacamole is deployed behind a reverse proxy with TLS. guacd, PostgreSQL and Guacamole must be isolated from public user networks. Generate short-lived Guacamole tokens/links for one CYBERTRACE user and one environment. The browser must never receive VM SSH keys or hypervisor credentials.

## Optional xterm.js

The real terminal can use xterm.js through a dedicated WebSocket gateway that:

- validates the CYBERTRACE session server-side;
- creates a short-lived SSH or SSH-over-WebSocket credential;
- opens an SSH connection to that user's VM only;
- never forwards arbitrary commands to the CYBERTRACE Node server;
- applies idle timeout and maximum session duration;
- logs terminal session metadata, not plaintext secrets.

## Network isolation

- Each VM receives one private VLAN or user-specific network namespace.
- Training targets are fixed addresses on a deny-by-default lab network.
- The VM network denies RFC1918 infrastructure ranges except explicitly authorized lab targets.
- Public destination ranges are denied.
- Hypervisor management, CYBERTRACE databases and Guacamole administration are on separate networks.
- VM outbound internet access should be disabled or tightly allowlisted.

## Persistence and cleanup

Persistent home volumes should be encrypted and quota-limited. Implement stop, restart, reset and expiry actions in the provider. Deleted environments must destroy temporary disks, credentials and network leases. Reset must replace or snapshot-reset the user's persistent storage only according to policy.

## Administrator operations

The existing CYBERTRACE admin role can list and stop/reset environments through:

- `GET /api/admin/kali/environments`
- `POST /api/admin/kali/environments/:userId/stop`
- `POST /api/admin/kali/environments/:userId/reset`

These routes require the existing CYBERTRACE administrator role.
