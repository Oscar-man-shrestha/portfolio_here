// Subject lift with Apple's on-device Vision framework (VNGenerateForegroundInstanceMaskRequest).
// Output keeps the original pixels inside the subject; only the background becomes transparent.
#import <Foundation/Foundation.h>
#import <Vision/Vision.h>
#import <CoreImage/CoreImage.h>
#import <ImageIO/ImageIO.h>

static void save(CVPixelBufferRef pb, NSString *path, CIContext *ctx) {
  CIImage *ci = [CIImage imageWithCVPixelBuffer:pb];
  CGImageRef cg = [ctx createCGImage:ci fromRect:ci.extent];
  CGImageDestinationRef d = CGImageDestinationCreateWithURL((__bridge CFURLRef)[NSURL fileURLWithPath:path], CFSTR("public.png"), 1, NULL);
  CGImageDestinationAddImage(d, cg, NULL);
  CGImageDestinationFinalize(d);
  CFRelease(d);
  printf("wrote %s %zux%zu\n", path.UTF8String, CGImageGetWidth(cg), CGImageGetHeight(cg));
  CGImageRelease(cg);
}

int main(int argc, const char **argv) {
  @autoreleasepool {
    if (argc < 3) { printf("usage: lift in outPrefix\n"); return 1; }
    NSString *inPath = @(argv[1]); NSString *prefix = @(argv[2]);
    CGImageSourceRef src = CGImageSourceCreateWithURL((__bridge CFURLRef)[NSURL fileURLWithPath:inPath], NULL);
    if (!src) { printf("read fail\n"); return 1; }
    CGImageRef img = CGImageSourceCreateImageAtIndex(src, 0, NULL);
    VNGenerateForegroundInstanceMaskRequest *req = [[VNGenerateForegroundInstanceMaskRequest alloc] init];
    VNImageRequestHandler *h = [[VNImageRequestHandler alloc] initWithCGImage:img options:@{}];
    NSError *err = nil;
    if (![h performRequests:@[req] error:&err]) { NSLog(@"perform: %@", err); return 1; }
    VNInstanceMaskObservation *obs = req.results.firstObject;
    if (!obs) { printf("no subject\n"); return 2; }
    CIContext *ctx = [CIContext context];
    NSIndexSet *all = obs.allInstances;
    printf("instances: %lu image: %zux%zu\n", (unsigned long)all.count, CGImageGetWidth(img), CGImageGetHeight(img));
    CVPixelBufferRef pb = [obs generateMaskedImageOfInstances:all fromRequestHandler:h croppedToInstancesExtent:NO error:&err];
    if (!pb) { NSLog(@"mask: %@", err); return 3; }
    save(pb, [prefix stringByAppendingString:@"_all.png"], ctx);
    if (all.count > 1) {
      [all enumerateIndexesUsingBlock:^(NSUInteger i, BOOL *stop) {
        NSError *e2 = nil;
        CVPixelBufferRef one = [obs generateMaskedImageOfInstances:[NSIndexSet indexSetWithIndex:i] fromRequestHandler:h croppedToInstancesExtent:YES error:&e2];
        if (one) save(one, [NSString stringWithFormat:@"%@_%lu.png", prefix, (unsigned long)i], ctx);
      }];
    }
  }
  return 0;
}
