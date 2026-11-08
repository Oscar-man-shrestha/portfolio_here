// Person segmentation matte (Apple Vision, accurate quality), written as a grayscale PNG at the input's size.
#import <Foundation/Foundation.h>
#import <Vision/Vision.h>
#import <CoreImage/CoreImage.h>
#import <ImageIO/ImageIO.h>

int main(int argc, const char **argv) {
  @autoreleasepool {
    if (argc < 3) { printf("usage: segp in.png out.png\n"); return 1; }
    CGImageSourceRef src = CGImageSourceCreateWithURL((__bridge CFURLRef)[NSURL fileURLWithPath:@(argv[1])], NULL);
    if (!src) { printf("read fail\n"); return 1; }
    CGImageRef img = CGImageSourceCreateImageAtIndex(src, 0, NULL);
    VNGeneratePersonSegmentationRequest *req = [[VNGeneratePersonSegmentationRequest alloc] init];
    req.qualityLevel = VNGeneratePersonSegmentationRequestQualityLevelAccurate;
    req.outputPixelFormat = kCVPixelFormatType_OneComponent8;
    VNImageRequestHandler *h = [[VNImageRequestHandler alloc] initWithCGImage:img options:@{}];
    NSError *err = nil;
    if (![h performRequests:@[req] error:&err]) { NSLog(@"perform: %@", err); return 1; }
    VNPixelBufferObservation *obs = req.results.firstObject;
    if (!obs) { printf("no result\n"); return 2; }
    CIImage *m = [CIImage imageWithCVPixelBuffer:obs.pixelBuffer];
    CGFloat sx = CGImageGetWidth(img) / m.extent.size.width, sy = CGImageGetHeight(img) / m.extent.size.height;
    m = [m imageByApplyingTransform:CGAffineTransformMakeScale(sx, sy)];
    CIContext *ctx = [CIContext context];
    CGColorSpaceRef gray = CGColorSpaceCreateDeviceGray();
    CGImageRef out = [ctx createCGImage:m fromRect:CGRectMake(0, 0, CGImageGetWidth(img), CGImageGetHeight(img)) format:kCIFormatL8 colorSpace:gray];
    CGImageDestinationRef d = CGImageDestinationCreateWithURL((__bridge CFURLRef)[NSURL fileURLWithPath:@(argv[2])], CFSTR("public.png"), 1, NULL);
    CGImageDestinationAddImage(d, out, NULL);
    CGImageDestinationFinalize(d);
    printf("mask %.0fx%.0f -> %zux%zu\n", m.extent.size.width / sx, m.extent.size.height / sy, CGImageGetWidth(out), CGImageGetHeight(out));
    CFRelease(d); CGImageRelease(out); CGColorSpaceRelease(gray);
  }
  return 0;
}
