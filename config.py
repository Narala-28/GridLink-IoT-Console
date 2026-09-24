from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://gridlink:gridlink_dev_password@localhost:5432/gridlink"
    mqtt_host: str = "emqx"
    mqtt_port: int = 1883
    mqtt_username: str = ""
    mqtt_password: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
