use std::{env, fs, process::Command};

fn main() -> anyhow::Result<()> {
    let args = env::args().skip(1).collect::<Vec<String>>();

    let version = avm::current_version()
        .map_err(|_e| anyhow::anyhow!("Anchor version not set. Please run `avm use latest`."))?;
    let binary_path = avm::current_version_binary_path(&version);
    if !fs::metadata(&binary_path).is_ok() {
        anyhow::bail!(
            "Anchor version {} not installed. Please run `avm use {}`.",
            version,
            version
        );
    }
    Command::new(binary_path).args(args).spawn()?;

    Ok(())
}
