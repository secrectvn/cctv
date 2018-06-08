#!/bin/bash
ln -s /usr/local/cuda/targets/x86_64-linux/lib/libcurand.so /usr/local/lib/libcurand.so
ln -s /usr/local/cuda/targets/x86_64-linux/lib/libcublas.so /usr/local/lib/libcublas.so
ln -s /usr/local/cuda/targets/x86_64-linux/lib/libcudart.so /usr/local/lib/libcudart.so

git clone https://github.com/OrKoN/darknet
rm darknet/Makefile
cp modifiedMakefile darknet/Makefile
cd darknet
make OPENCV=1 GPU=1
make install

npm install @moovel/yolo --unsafe-perm