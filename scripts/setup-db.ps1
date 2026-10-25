# Creates the local PostgreSQL role and database for development. Asks for confirmation first.
param([string]$DbName = 'news', [string]$DbUser = 'news', [string]$PgSuperUser = 'postgres')
$pw = Read-Host -AsSecureString "Password for new DB role '$DbUser'"
$plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($pw))
Write-Host "This will create role '$DbUser' and database '$DbName' using superuser '$PgSuperUser'."
if ((Read-Host 'Continue? (y/N)') -ne 'y') { exit 1 }
$sql = "CREATE ROLE $DbUser LOGIN PASSWORD '$($plain.Replace("'","''"))'; CREATE DATABASE $DbName OWNER $DbUser;"
psql -U $PgSuperUser -h localhost -c $sql
Write-Host "Now put this in .env:  DATABASE_URL=postgresql://${DbUser}:<password>@localhost:5432/$DbName"
Write-Host "Prisma migrate dev also needs CREATEDB on the role:  ALTER ROLE $DbUser CREATEDB;"
