# Copiar a: scripts\oracle-retry.config.ps1
# Completar OCIDs — ver deploy/ORACLE-RETRY.md

$script:OracleRetryConfig = @{
    DisplayName         = "lch-prod"
    AvailabilityDomain  = "ZNTL:SA-SAOPAULO-1-AD-1"   # AD-1 São Paulo
    CompartmentId       = "ocid1.compartment.oc1..AAAA..." 
    SubnetId            = "ocid1.subnet.oc1.sa-saopaulo-1..aaaa..."  # public subnet-lch-vcn
    ImageId             = "ocid1.image.oc1.sa-saopaulo-1..aaaa..."   # Ubuntu 22.04 aarch64
    Ocpus               = 1
    MemoryGB            = 6
    # Dejar vacío para que Oracle elija fault domain (recomendado)
    FaultDomain         = ""
    SshPublicKeyPath    = "$env:USERPROFILE\.ssh\lch-oracle.pub"
}
