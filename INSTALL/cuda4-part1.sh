#https://devtalk.nvidia.com/default/topic/1000340/cuda-setup-and-installation/-quot-nvidia-smi-has-failed-because-it-couldn-t-communicate-with-the-nvidia-driver-quot-ubuntu-16-04/4
sudo apt-key adv --fetch-keys http://developer.download.nvidia.com/compute/cuda/repos/ubuntu1604/x86_64/7fa2af80.pub
sudo echo "# NVIDIA Graphics Driver Repo (Added by Shinobi installer)" | sudo tee -a /etc/apt/sources.list
sudo echo "# Public Key : sudo apt-key adv --fetch-keys http://developer.download.nvidia.com/compute/cuda/repos/ubuntu1604/x86_64/7fa2af80.pub" | sudo tee -a /etc/apt/sources.list
sudo echo "deb http://developer.download.nvidia.com/compute/cuda/repos/ubuntu1604/x86_64 /" | sudo tee -a /etc/apt/sources.list
apt update
sudo apt -y install nvidia-340 nvidia-340-dev nvidia-modprobe libcuda1-340 libcuda1-340-updates nvidia-prime

echo "After rebooting you need to run part 2. The file is named `cuda9-part2-after-reboot.sh`."
echo "Reboot is required. Do it now?"
echo "(y)es or (N)o"
read rebootTheMachineHomie
if [ "$rebootTheMachineHomie" = "y" ] || [ "$rebootTheMachineHomie" = "Y" ]; then
    sudo reboot
fi