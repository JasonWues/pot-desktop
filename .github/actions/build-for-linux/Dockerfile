# bookworm: Tauri 2 needs webkit2gtk 4.1, which bullseye does not ship
FROM rust:bookworm
COPY entrypoint.sh /entrypoint.sh
RUN chmod a+x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"] 